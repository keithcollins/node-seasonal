"use strict";

const fs = require('fs');
const rimraf = require('rimraf');
const d3 = Object.assign({}, require('d3-dsv'));
const { execSync } = require('child_process');

const seasonal = {};

// Return auto-adusted figures appended to input data
seasonal.adjust = function(data,opts) {
  
  // Set defaults and check inputs
  seasonal.opts = initOptions(data,opts);

  // Auto detect dates and update global obj
  getDateExtent();

  // Create an x13 input .spc file for each set of values
  createInputFiles();

  // Run binary for each set of values and append to input data
  collateSeasonalData();

  // Delete temp directory if it exists, and contents
  cleanUp(seasonal.opts.temp_dir);

  // Return data with appended seasonal adjustments
  return seasonal.opts.data;
}

// Run custom spec file
seasonal.custom = function(opts) {
  seasonal.opts = initCustomOptions(opts);
  executeX13();
}

function initOptions(data,opts) {

  // Check input data
  if (!data || !Array.isArray(data) || data.length <= 0) {
    exitError("Input data does not exist, is not array or is empty.");
  } 

  // Check required props
  if (!opts.date_field) {
    exitError("A value is required in the date_field property.");
  } 
  if (!opts.value_fields || !Array.isArray(opts.value_fields) || opts.value_fields.length <= 0) {
    exitError("The value_fields property must contain an array of at least one value.");
  }
  if (!opts.table_ids || !Array.isArray(opts.table_ids) || opts.table_ids.length <= 0) {
    exitError("The table_ids property must contain an array of at least one value.");
  }

  // Set log to off by default
  opts.log = opts.log || false;
  // Set default temp directory
  opts.temp_dir = `${__dirname}/temp`;
  // Add data to retain changes in global obj
  opts.data = data;
  // Set output directory
  if (opts.output_dir) {
    // If defined output directory doesn't exist, create
    if (!fs.existsSync(opts.output_dir)) fs.mkdirSync(opts.output_dir);
  } else {
    // If no output directory defined, add temp
    if (!fs.existsSync(opts.temp_dir)) cleanUp(opts.temp_dir);
    fs.mkdirSync(opts.temp_dir);
    opts.output_dir = opts.temp_dir;
  }

  return opts;
}

function initCustomOptions(opts) {
  // Check required props
  if (!opts.input_file_path) {
    exitError("No input file specified.");
  }
  // Set log to off by default
  opts.log = opts.log || false;
  return opts;
}

// Get range of years and earliest month for use in x13 input file
function getDateExtent() {
  const opts = seasonal.opts;
  const years = opts.data.map(d=>+getYearFromDate(d[opts.date_field]));
  // Get min/max years
  opts.start_year = Math.min(...years);
  opts.end_year = Math.max(...years);
  // Get earliest month from earliest year
  opts.start_month = Math.min(...opts.data
    .filter(d=>+getYearFromDate(d[opts.date_field])==opts.start_year)
    .map(d=>+getMonthFromDate(d[opts.date_field])));
  // Zero-pad months
  if (opts.start_month < 10) `0${opts.start_month}`;

  // Validate detected dates
  if (+opts.start_month < 1 || +opts.start_month > 12) {
    exitError("Detected start month was not between 1 and 12.");
    process.exit(1);
  }
  if (opts.start_year.toString().length > 4 || opts.start_year.toString().length < 4) {
    exitError("Detected start year was not four digits long.");
    process.exit(1);
  }
  if (opts.end_year.toString().length > 4 || opts.end_year.toString().length < 4) {
    exitError("Detected end year was not four digits long.");
    process.exit(1);
  }

  seasonal.opts = opts;
}

// Create one input file for each set of values
function createInputFiles() {
  const opts = seasonal.opts;

  // Create input file for auto-adjustment
  for (let val_field of opts.value_fields) {
    let spec = `series {\n`
    spec += `title = "node-seasonal auto adjust"\n`;
    spec += `data = (\n`;
  
    // x13 expects 12 space-delimited values for each year to be adjusted
    for (let y = opts.start_year; y <= opts.end_year; y++) {
      spec += opts.data
        .filter(d=>+getYearFromDate(d[opts.date_field]) == y)
        .sort((a,b)=>+combineYearMonth(a[opts.date_field]) - +combineYearMonth(b[opts.date_field]))
        .map(d=>d[val_field])
        .join(" ")+"\n";
    }
  
    spec += `)\n`;
    spec += `start = ${opts.start_year}.${opts.start_month}\n`;
    spec += `}\n`;
    spec += `x11{ save = (${opts.table_ids.join(" ")}) }`;
  
    // Save input file
    try {
      fs.writeFileSync(`${opts.output_dir}/node_seasonal_${val_field}.spc`,spec,"utf8");
    } catch(err) {
      exitError(err);
    }
  }
}

// For each field and table defined, run x11 to generate data, collect it, append it to input data
function collateSeasonalData() {
  const opts = seasonal.opts;
  for (let val_field of opts.value_fields) {
    const seas = getSeasonalData(val_field);
    for (let table_id of opts.table_ids) {
      seasonal.opts.data.forEach(d=>{
        const adj = seas[table_id].filter(a=>a[opts.date_field]==d[opts.date_field])[0];
        d[`${val_field}_${table_id}`] = (adj) ? +adj.val : "";
      });
    }
  }
}

// For this value field, run x13, return object with properties for each table requested
function getSeasonalData(val_field) {
  const opts = seasonal.opts;
  executeX13(val_field);
  const obj = {};
  for (let table_id of opts.table_ids) obj[table_id] = formatSeasonalData(val_field,table_id);
  return obj;
}

// Run x13ashtml binary executable in shell with input file saved above as argument
function executeX13(val_field) {
  const opts = seasonal.opts;

  // Get user-inputted path or generated one
  const input_file_path = opts.input_file_path || `${opts.output_dir}/node_seasonal_${val_field}`;

  // Get binary path based on user OS: could be 'darwin', 'freebsd', 'linux', 'sunos', 'win32'
  let bin_path = `${__dirname}/x13binary/osx/bin/x13ashtml`;
  if (process.platform === "win32") bin_path = `${__dirname}/x13binary/win/bin/x13ashtml.exe`;

  try {
    let stdout = execSync(`${bin_path} ${input_file_path}`);
    if (opts.log) console.log(stdout.toString());
  } 
  catch (err) {
    exitError(err.message);
    // console.log(err.status);
    // console.log(err.message);
    // console.log(err.stderr.toString());
    // console.log(err.stdout.toString());
  }
}

// x13ashtml saves seasonally adjusted data to a tab-separated file
function formatSeasonalData(val_field,table_id) {
  const opts = seasonal.opts;
  return d3.tsvParse(fs.readFileSync(`${opts.output_dir}/node_seasonal_${val_field}.${table_id}`,"utf8"))
    .filter(d=>d.date!=="------")
    .map(d=>{
      return {
        month: d.date.substr(0, 4) + "-" + d.date.substr(4),
        val: Number.parseFloat(+d[`node_seasonal_${val_field}.${table_id}`]).toFixed(2)
      }
    });
}

function exitError(message) {
  console.log(new Error(message));
  process.exit(1);
}

// Delete directory and contents
function cleanUp(dir) {
  if (fs.existsSync(dir)) {
    try {
      rimraf.sync(dir);
    } catch (err) {
      exitError(err);
    }
  }
}

function getYearFromDate(date) {
  return date.split("-")[0];
}

function getMonthFromDate(date) {
  return date.split("-")[1];
}

function combineYearMonth(date) {
  return +date.split("-").join("");
}

module.exports = seasonal;