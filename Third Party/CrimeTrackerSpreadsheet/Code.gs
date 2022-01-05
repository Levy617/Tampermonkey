// Global constants
const scriptProperties = PropertiesService.getScriptProperties();
//const ui = SpreadsheetApp.getUi();
const APIkey = getApiKey();
const baseURL = "https://api.torn.com/user/?comment=MyCrimesLog&selections=log&log=5700,5705,5710,5715,5720,5725,5730,5735,6791,8842&";

const timestampURL = "https://api.torn.com/torn/?comment=MyCrimesLog&selections=timestamp&key=" + APIkey;
const datasheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Log");
const totalsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Totals");
const statusTitleCell = totalsSheet.getRange('AA14');
const statusCell = totalsSheet.getRange('AA15');
const timeCell = totalsSheet.getRange('AA16');
const maxRunTime = 275000;
const debug = false;

// If debug is enabled, 'console.debug(...)' will spit out stuff to the execution log.
// Otherwise, it won't. Supports full object expansion. For example,
// let obj = {me: 'ed', value: 25, something: {a: 3, b: 4}};
// console.debug('Obj = ', obj); 
// will output: 'Obj =  { me: 'ed', value: 25, something: { a: 3, b: 4 } }'
// without having to stringify first.
if (!debug) {console.debug = function(){};}
else {console.debug = function(...x){console.log(...x)};}

// Get current crime data
function myCurrentCrimeLog() {
  console.log('[myCurrentCrimeLog] ==>');
  setStatusTitle('Getting current crime data...');
  updateElapsed();
  let jsonTornData = queryData(baseURL + "key=" + APIkey);
  let keys = Object.keys(jsonTornData.log);
  let lastlog = datasheet.getRange("A7").getValue();

  setStatusTitle('Parsing current log data...');
  if (keys.length <= 0) {
    setStatusTitle('Nothing to do!');
    return;
  }

  for (let i = 0; i < keys.length; i++) {
    setStatus('Parsing entry ' + (i+1) + ' of ' + keys.length);
    updateElapsed();
    let row = 7 + i;
    let time = jsonTornData.log[keys[i]].timestamp;
    
    if (time > lastlog) {
      datasheet.insertRowAfter(row-1);
      setRowFormulas(row, time);
      logCrimeData(jsonTornData.log[keys[i]], row);
    }
  }
  setStatus('');
  setStatusTitle('Success!');
  console.log('<== [myCurrentCrimeLog]');
}

// Get past crime data
function myPastCrimeLog() {
  console.log('[myPastCrimeLog] ==>');
  updateElapsed();
  let starttime = new Date();
  let runtime = 0;
  let lastrow = datasheet.getLastRow();

  // Delete any previously set trigger
  let triggerId = scriptProperties.getProperty('TRIGGER_ID');
  if (triggerId) {
    deleteTrigger(triggerId);
    scriptProperties.setProperty('TRIGGER_ID', 0);
  }
  
  //if log is empty, start with today's timestamp, else look for the earliest timestamp
  if (lastrow == 6) {
    let jsonTornData = queryData(timestampURL);
    var lasteventdate = jsonTornData.timestamp[0];
  } else {
    var lastgoodrow = lastrow - 1;
    var lasteventdate = datasheet.getRange("A" + lastgoodrow).getValue();
    datasheet.deleteRow(lastrow);
  }

  setStatusTitle('Getting past log data...');
  let jsonTornData = queryData(baseURL + "to=" + lasteventdate + "&key=" + APIkey);
  let keys = Object.keys(jsonTornData.log);

  if (keys.length <= 0) {
    setStatusTitle('Nothing to do!');
    console.log('<== [myPastCrimeLog]');
    return;
  }

  //iterate until no more results 
  let time = 0, counter = 1;
  while (keys.length > 0 && runtime < 275000) {
    setStatusTitle('Parsing past log data (pass ' + (counter++) + ')');
    let grouprow = datasheet.getLastRow();
    let firstentry = jsonTornData.log[keys[0]].timestamp;
    for (let i = 0; i < keys.length; i++) {
      setStatus('Parsing entry ' + (i+1) + ' of ' + keys.length);
      updateElapsed();
      time = jsonTornData.log[keys[i]].timestamp;
      let row = grouprow + 1 + i;
      setRowFormulas(row, time);
      
      logCrimeData(jsonTornData.log[keys[i]], row);
    }

    //record last timestamp from previous API call before making next call
    if (time) lasteventdate = time;
    setStatus('Parse complete.');

    // Get next chunk of data (log entries) to parse, 100 at a time.
    //API function call will sometimes return same crimes, repeat until new set with a pause
    let nextentry = firstentry;
    while (firstentry == nextentry) {
      url = baseURL + "to=" + lasteventdate + "&key=" + APIkey;
      jsonTornData = queryData(url);    
      try {
        keys = Object.keys(jsonTornData.log);
        nextentry = jsonTornData.log[keys[0]].timestamp;
      } catch (error) {
        Logger.log(error);
      }
      Logger.log(firstentry, " = ", nextentry);
      if (firstentry == nextentry) {
        Utilities.sleep(8000);
      }
    }
    //check runtime after each call, ends at 5 minutes
    runtime = new Date() - starttime;
  }

  // If we exceeded our max runtime, set a trigger to fire to restart.
  if (runtime > maxRunTime) {
    let triggerId = createTimeDrivenTrigger(10); // 10 seconds.
    scriptProperties.setProperty('TRIGGER_ID', triggerId);
    console.log('Saved triggerId ' + triggerId + ' to resume in 10 seconds');
    setStatus('');
    setStatusTitle('Pausing, will resume soon...');
    return console.log('<== [myPastCrimeLog]');
  }

  setStatus('');
  setStatusTitle('Success!');
  console.log('<== [myPastCrimeLog]');
}

// Helpers to indicate status on the main sheet.
function setStatus(msg) {
  console.debug(msg);
  statusCell.setValue(msg);
  }

function setStatusTitle(msg) {
  console.debug(msg);
  statusTitleCell.setValue(msg);
  }

// Helper to update elapsed time
var displayTimeStart = 0;
function updateElapsed() {
  let now = new Date().getTime();
  if (!displayTimeStart) return (displayTimeStart = now);
  let elapsed = now - displayTimeStart; 
  timeCell.setValue('Elapsed time: ' + millisToMinutesAndSeconds(elapsed));
}

function millisToMinutesAndSeconds(millis) {
  var minutes = Math.floor(millis / 60000);
  var seconds = ((millis % 60000) / 1000).toFixed(0);
  //return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
  return (seconds == 60 ? (minutes+1) + ":00" : minutes + ":" + (seconds < 10 ? "0" : "") + seconds);
}

// Helper: log crime data
function logCrimeData(logEntry, row) {
  let categorynum = logEntry.log;
  if (categorynum == "8842") { // Nerve bar change
    var nervechange = 
      "Nerve has increased from " + logEntry.data.maximum_nerve_before + " to " + logEntry.data.maximum_nerve_after;
    datasheet.getRange("D"+ row ).setValue(nervechange);
  } else { // OC or reguar crimes
    var crime = logEntry.data.crime;
    datasheet.getRange("B"+ row ).setValue(crime);
    
    if (categorynum == "6791") { // OCs
      var result = logEntry.data.result;
    } else { // Regular crimes
      var result = logEntry.title;
      logMoneyGains(logEntry, row);
    }
    datasheet.getRange("D"+ row ).setValue(result);
  }
}

// Helper: record money gains
function logMoneyGains(logEntry, row) {
  console.debug('[logMoneyGains] ==>');
  let money_gain = logEntry.data.money_gained;
  let money_lost = logEntry.data.money_lost;
  let item_gain = logEntry.data.item_gained;

  datasheet.getRange("F"+ row ).setValue(money_gain);
  datasheet.getRange("G"+ row ).setValue(money_lost);
  datasheet.getRange("H"+ row ).setValue(item_gain);
  console.debug('<== [logMoneyGains]');
}

// Helper - set row formulas
function setRowFormulas(row, time) {
  console.debug('[setRowFormulas] ==>');
  let formulaC = "=if(B"+row +"=\"\",\"\",if(or(D"+row +"=\"failure\",D"+row +
                "=\"success\"),vlookup(B"+row +",OCs,2,false),vlookup(B"+row +",Crimes,2,false)))";
  let formulaE = "=if(B"+row +"=\"\",\"\", vlookup(D"+row +",Results,2,false))";
  let formulaI = "=if(isblank(H"+row +"),sum(F"+row +",-G"+row +"),vlookup(H"+row +",Items,10,false))";
  let formulaJ = "=if(B"+row +"=\"\",\"\",if(D"+row +"=\"success\",vlookup(B"+row +
                 ",OCs,3,false),vlookup(B"+row +",Crimes,3,false)*ifs(E"+row +
                "=\"Success\",1,E"+row +"=\"Jail\",-20,True,0)))";

  datasheet.getRange("A"+ row ).setValue(time);
  datasheet.getRange("C" + row).setFormula(formulaC);
  datasheet.getRange("E" + row).setFormula(formulaE);
  datasheet.getRange("I" + row).setFormula(formulaI);
  datasheet.getRange("J" + row).setFormula(formulaJ);
  console.debug('<== [setRowFormulas]');
}

// Helper: create time-driven trigger
function createTimeDrivenTrigger(timeSecs) {
  return ScriptApp.newTrigger("myPastCrimeLog")
      .timeBased()
      .after(timeSecs * 1000) // After timeSecs seconds 
      .create();
}

// Helper: delete a trigger
function deleteTrigger(triggerId) {
  var allTriggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < allTriggers.length; i++) {
    if (allTriggers[i].getUniqueId() === triggerId) {
      ScriptApp.deleteTrigger(allTriggers[i]);
      break;
    }
  }
}

function getApiKey() {
  console.log('[getApiKey] ==>');
  let scriptProperties = PropertiesService.getScriptProperties();
  let key = scriptProperties.getProperty("API_KEY");

  if ((key == null) || (key == '')) {
    let ui = SpreadsheetApp.getUi();
    let response = ui.prompt('Enter API Key');

    if (response.getSelectedButton() == ui.Button.OK) {
      key = response.getResponseText();
    scriptProperties.setProperty('API_KEY', key);
    }
  }
  console.log('<== [getApiKey]');
  return key;
}

function resetApiKey() {
  console.debug('[resetApiKey] ==>');
  let ui = SpreadsheetApp.getUi();
  var response = ui.prompt('Enter New API Key');

  if (response.getSelectedButton() == ui.Button.OK) {
    key = response.getResponseText();
    scriptProperties.setProperty('API_KEY', key);
  }
  console.debug('<== [resetApiKey]');
}

function queryData(url) {
  console.debug('[queryData] ==>');
  let object = null;
  let jsondata = null;
  try {
    jsondata = UrlFetchApp.fetch(url);
  } catch(e) {
    setStatus("UrlFetchApp() failed!");
    console.error('Error: ', e);
    Logger.log("UrlFetchApp failed");
  }

  // This line fails sometimes. Need to catch the exception. Not sure why it fails...
  try {
    object = JSON.parse(jsondata.getContentText());
  } catch(error) {
    setStatus("JSON.parse() failed!");
    console.error('Error: ', error);
    Logger.log("JSON.parse failed");
    console.log('<== [queryData] Error.');
    return null;
  }
  console.debug('<== [queryData]');
  return object;
}