document.getElementById('loginBtn').addEventListener('click', function() {
  
  // 1. Determine the Login Domain (MyDomain vs Generic)
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTab = tabs[0];
    let loginDomain = "https://login.salesforce.com";

    if (currentTab && currentTab.url) {
      try {
        const urlObj = new URL(currentTab.url);
        if (urlObj.hostname.includes("salesforce.com") || urlObj.hostname.includes("force.com")) {
          loginDomain = urlObj.origin; 
        } else if (urlObj.hostname.includes("salesforce-setup.com")) {
          loginDomain = urlObj.origin.replace('salesforce-setup.com', 'salesforce.com'); 
        }
      } catch (e) {}
    }

    // 2. Construct the Redirect URI pointing to OUR extension file
    const CALLBACK_URL = `chrome-extension://${chrome.runtime.id}/callback.html`;
    const CLIENT_ID = '3MVG99OxTyEMCQ3ipt3qRQgxCzFjNU7JCZDeTf2Mq_rIFVPgASjAq9r4E.2yUKcVx0isUR08zZQ3q45UGjQlX';

    // 3. Build Auth URL
    const AUTH_URL = `${loginDomain}/services/oauth2/authorize` +
                     `?client_id=${CLIENT_ID}` +
                     `&response_type=hybrid_token` +
                     `&redirect_uri=${encodeURIComponent(CALLBACK_URL)}`;

    // 4. Open the tab
    chrome.tabs.create({ url: AUTH_URL });
    
    // 5. Close popup
    window.close();
  });
});