//only track time of specific sites
//user enters site
//show list of time spent on sites we're tracking
//show input dialog to add site
//show x right of time item to stop tracking site
//

class ChromeAPI {
    static setTabActivatedListener(func){
        chrome.tabs.onActivated.addListener(func);
    }
    static setTabUpdatedListener(func){
        chrome.tabs.onUpdated.addListener(func);
    }

    static setAlarmFunction(input){
        //create alarm if not already created
        if(chrome.alarms.get(input.alarmName,(alarm) => {
            if(alarm == null){
                chrome.alarms.create(input.alarmName,{ periodInMinutes: input.period });
                console.log(`${input.alarmName} alarm created!`);
            }
        }));
        // //update storage every mimnute not just on active tab change
        chrome.alarms.onAlarm.addListener(input.alarmFunction);
    }
    
    static clearAlarm(alarmName){
        chrome.alarms.clear(alarmName,(wasCleared)=>{
            console.log(`${alarmName} alarm was cleared!`);
        });
    }

    static setMessageReceiver(receiver){
        chrome.runtime.onMessage.addListener(receiver);
    }
}

const date = new Date().toISOString().split('T')[0];
const trackingMap = new Map();
const alarmName = 'timeAccumulator';
var activeUrl = null;//the current tracked active url
var currentUrl = null;//the current url activa url
var startTime = 0;


/**
 * Save tracking data to chrome.storage api by date
 */
function saveTrackingToStorage(){
    let mapValues = {
        // activeUrl: activeUrl,
        //startTime: startTime,
        trackingSites: Array.from(trackingMap.keys()),
        trackingTimes: Array.from(trackingMap.values()),
    }
    let obj = {};
    obj[date] = mapValues;
    chrome.storage.sync.set(obj,()=>{});
}

/**
 * Read the tracking data by date using chrome.storage api
 */
function readTrackingDataFromStorage(){
    //grab domains to track from storage
    chrome.storage.sync.get([date], (result)=>{
        if(result != null ){
            if(result[date] != null){
                let mapValues = result[date];
                setMapValues(mapValues.trackingSites,mapValues.trackingTimes);
                //need to set activeUrl
                
            }
        }
    });
}

function setMapValues(sites,times){
    let i = 0;
    while(i < sites.length){
        trackingMap.set(sites[i],times[i]);
        i++;
    } 
}

var onAlarm = (alarm) => {
    console.log('called alarm!');
    //check if start time is at most 1 minute and 10s(small buffer)
    //before current time
    if(activeUrl == null){
        return;
    }
    //if larger then don't accumulate the time because this means the alarm didn't go off in time
    let timeSpent = getTimeElapsed();
    //update map 
    trackingMap.set(activeUrl,timeSpent);
    startTime = Date.now();
    saveTrackingToStorage();
};

/*
    If a new url is now in the active tab
    then determine if we have to start tracking it or
    stop tracking current one
*/
function onUrlChange(url){
    if(url != null && url != ''){
        let hostname = new URL(url).hostname;
        currentUrl = hostname;
        //console.log(`currentUrl : ${currentUrl}`);
        //if this is not a site we are currently tracking 
        //we do not need to consider it
        //console.log(`map => ${Array.from(trackingMap)}`);
        //we switch to another tracked site
        if(trackingMap.has(hostname)){
            //if tracked but not active set as active
            if(activeUrl != currentUrl){
                //save the old time
                activeUrl = hostname;
                let timeSpent = getTimeElapsed();
                trackingMap.set(activeUrl,timeSpent);
                //we can the set activeUrl to hostname
                startTime = Date.now();
                //console.log(`activeUrl: ${activeUrl}`);
                saveTrackingToStorage();
                //start tracking now
                ChromeAPI.setAlarmFunction({
                    alarmName: alarmName,
                    period: 1, 
                    alarmFunction: onAlarm});
            }
        }else{
            //the alarm should continue to run 
            //but it should check activeUrl
            activeUrl = null;
            startTime = -1;
            //just turn off alarm honestly
            ChromeAPI.clearAlarm(alarmName);
        }
    }
}


function getTimeElapsed(){
    let now = Date.now();
    let timeSpent = 0;
    //grab the saved time
    if(trackingMap.get(activeUrl) != null){
        timeSpent = trackingMap.get(activeUrl);
    }
    //if now and starttime difference is greater than a minute then 
    //some event happened where alarm didnot fire and now time spent
    //is not accurate
    if((now - startTime)/ 1000 > 70){
        startTime = Date.now();//reset time 
        console.log('time delta too long between alarms inaccurate time spent');
        return timeSpent;
    }
    //nothing went wrong 
    return ((now - startTime)/ 1000) + timeSpent ;
}

var tabListener = async () => {
    let [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    //console.log('called tabListener()');
    if(tab.url != undefined){
        onUrlChange(tab.url);
    }
};
function onLoadServiceWorker(){
    //run when the service worker is loaded
    /*
        change timer if move to a site that we are tracking
    */
    //service workers are loaded and unloaded
    ChromeAPI.setTabActivatedListener(tabListener);
    ChromeAPI.setTabUpdatedListener(tabListener);
    //ChromeAPI.setAlarmFunction({alarmName: alarmName,period: 1, alarmFunction: onAlarm});
    //add new url to tracking list
    ChromeAPI.setMessageReceiver((request,sender,sendResponse) => {
        if(request.addUrlRequest != null){
            //set a new tracking url in storage
            //grab current url
            //since currentUrl and activeUrl can be the same
            let newTrackingUrl = null;
            if(currentUrl != null && !trackingMap.has(currentUrl)){
                console.log(`tracking => ${currentUrl}`);
                newTrackingUrl = currentUrl;
                trackingMap.set(currentUrl,0);
                saveTrackingToStorage();
                activeUrl = currentUrl;
                startTime = Date.now();
            }
            sendResponse({newTrackingUrl: newTrackingUrl});
            
        }
    });

    readTrackingDataFromStorage();
    //need to call this once
    tabListener();
}
//named as such because
//service_workers are loaded and unloaded based on events
//also for clarity when service worker is loaded
//this script will run
onLoadServiceWorker();