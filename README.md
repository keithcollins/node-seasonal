# node-seasonal
A simple Node.js for X-13-ARIMA-SEATS, the seasonal adjustment software by the U.S. Census Bureau

  seasonal.custom({
    input_file_path: `${__dirname}/input_file`, // do not include spc extension
    log: true
  });

  const options = {
    date_field: "month",
    value_fields: ["long_guns_sold", "handguns_sold", "total_sold_nyt", "total_sold_saaf"],
    table_ids: ["d11","d12","d13"],
    output_dir: `${__dirname}/output`, // if blank, output files are deleted
    log: true
  };