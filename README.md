# node-seasonal
A simple Node.js wrapper for X-13-ARIMA-SEATS, the seasonal adjustment software by the U.S. Census Bureau

## Installation and usage

Install:

```
npm install --save node-seasonal
```

Use: 

```js
const seasonal = require('node-seasonal');

// Your input data must be an array of objects with the requred fields
const input_data = [
  {
    month: "1998-01",
    shoe_sales: 100343,
    shirt_sales: 35991
  },
  // { ... } etc etc
];

const options = {
  date_field: "month", // Dates must be formatted YYYY-MM
  value_fields: ["shoe_sales", "shirt_sales"], // All values in data to adjust
  table_ids: ["d11"], // d11 is standard seasonal adjustment
  output_dir: `${__dirname}/output`, // x13 files deleted if left empty
  log: true // Whether to log output of x13 command
};

const adjusted_data = seasonal.adjust(input_data, options);
```

The above will auto-adjust the input data and append it. The output will include the original data, with new fields for the adjustment which include the table ID of the calculation requested. That is, in the example above, `adjusted_data` would look like this:

```js
[
  {
    month: "1998-01",
    shoe_sales: 100343,
    shirt_sales: 35991,
    shoe_sales_d11: 90443,
    shirt_sales_d11: 38002
  },
  // { ... } etc etc
]
```

Each valid table ID specified in the options will append a new field for each value field specified.

## Options

**Required properties for `seasonal.adjust()` options:**

`date_field` (String) Date format must be YYYY-MM

`value_fields` (Array of strings) Should include all fields in input data that should be seasonally adjusted

`table_ids` (Array of strings) Refer to the [x13ashtml reference manual](https://www.census.gov/ts/x13as/docX13ASHTML.pdf) for a listing of codes (`d11` is final seasonally adjusted numbers)


**Optional properties for `seasonal.adjust()` options:**

`output_dir` (String) Where to output x13ashtml files. If empty or null, output files are deleted.

`log` (Boolean) Whether to log output of x13ashtml command, which is useful for debugging. (Default is false.)


## Use a custom .spc file

```js
seasonal.custom({
  input_file_path: `${__dirname}/input_filename`, // Required
  log: true // Optional (default is false)
});
```

This simply runs a .spc file you create on your own and saves the x13ashtml output files. The files will be saved to the same directory where the input spec file is. Refer to the [x13ashtml reference manual](https://www.census.gov/ts/x13as/docX13ASHTML.pdf) for the specifications of the input files.
