//grab sites and populate ui with sites from site list
//populate list with sites that are currently being tracked
//sites are saved as maps by date in yyyy-mm-dd format
const date = new Date().toISOString().split('T')[0];
const trackingMap = new Map();
const MINUTES_S = 60;
const HOURS_S = 60 * MINUTES_S;
var activeUrl = null;

document.getElementById("addUrlButton").addEventListener('click',(event)=>{
    //grab active url
    console.log('clicked add current!');
    //add activeUrl to tracking list
    //send message to background.js
    addCurrentUrl();
    
});

let listItemOnClickListener = (event) => {
    //set the current item to have the active class
    //remove the active class from whatever element had it previously
    let prevActive = document.getElementsByClassName('active-item')[0];
    if(prevActive != null){
        prevActive.classList.remove('active-item');
    }
    let current = event.target;
    current.classList.add('active-item');
    // let collapse = document.getElementsByClassName('options-container')[0].classList.add('show');
    // let bscollapse = new bootstrap.Collapse(collapse, {
    //     toggle: true
    //   })
      
};

function addCurrentUrl(){ 
    //need to send message to background
    chrome.runtime.sendMessage({addUrlRequest: 1},(response) => {
        if(response != null && response.newTrackingUrl != null){
            console.log('received url: '+response.newTrackingUrl);
            trackingMap.set(response.newTrackingUrl,0);
            showSites();
        }
    });
}

function showSites(){
    //show lists
    //add a list item to the list of sites
    let list = document.getElementsByTagName('ul')[0];
    let entries = Array.from(trackingMap.entries());
    let i = 0;
    while(i < entries.length){
        let entry = entries[i];
        addSiteToList(entry[0],entry[1],list);
        i++;
    }
}

function getTimeElement(domain,duration){

    let getTimeString = (timeSpent) => {
        //return a formatted string 
        let tsInt = Math.floor(timeSpent);
        //format => x hours y minutes
        let hours = Math.floor(tsInt / HOURS_S);
        let minutes = Math.floor((tsInt % HOURS_S) / MINUTES_S);
    
        if(hours <= 0){
            return `${minutes} min`;
        }else{
            return `${hours} hr ${minutes} min`;
        }
    };

    return `<div class="duration mb-1">
            ${getTimeString(duration)}
            </div>
            <span class="domain m-1">
                <img src="https://s2.googleusercontent.com/s2/favicons?domain=${domain}" />
                ${domain}
            </span>
            `;
}

function addSiteToList(url,duration,list){
    let classes = "list-item d-flex flex-column p-3".split(' ');
    let listItem = document.createElement('li');
    let i = 0;
    while(i < classes.length){
        listItem.classList.add(classes[i]);
        i++;
    }
    listItem.innerHTML = getTimeElement(url,duration);
    listItem.addEventListener('click',listItemOnClickListener);
    listItem.setAttribute('data-bs-toggle','collapse');
    listItem.setAttribute('data-bs-target','options');
    list.appendChild(listItem);
}

function getTrackingSites(){
    //grab domains to track from storage
    chrome.storage.sync.get([date], (result)=>{
        if(result != null){
            let mapValues = result[date];
            if(mapValues != null){
                //
                setMapValues(mapValues.trackingSites,mapValues.trackingTimes);
                showSites();
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


getTrackingSites();
