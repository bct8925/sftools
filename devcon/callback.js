// callback.js

const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 1. Get the hash from the URL (where Salesforce puts the token)
const hash = window.location.hash.substring(1); // Remove the '#'
const params = new URLSearchParams(hash);

const accessToken = params.get('access_token');
const instanceUrl = params.get('instance_url');

sleep(1000).then(() => {
    if (accessToken && instanceUrl) {
        document.getElementById('status').innerText = "Session acquired. Redirecting...";
    
        // 2. Define where we want to end up
        const targetPath = "/_ui/common/apex/debug/ApexCSIPage";
    
        // 3. Construct the Frontdoor URL
        // We do this client-side, and then simply navigate the window there.
        const frontDoorUrl = `${instanceUrl}/secur/frontdoor.jsp` + 
                             `?sid=${encodeURIComponent(accessToken)}` + 
                             `&retURL=${encodeURIComponent(targetPath)}`;
    
        // 4. Perform the Redirect
        // usage of 'replace' prevents the user from hitting "Back" and landing on this auth page again
        window.location.replace(frontDoorUrl);
    
    } else {
        document.getElementById('status').innerHTML = 
            "<span style='color:red'>Authentication failed. No token found in URL.</span>";
        console.error("Missing params", hash);
    }
});