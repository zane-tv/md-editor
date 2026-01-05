import { gapi } from 'gapi-script';

const DISCOVERY_DOCS = [
  'https://docs.googleapis.com/$discovery/rest?version=v1',
  'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
];

// Load GIS script dynamically
const loadGisScript = () => {
  return new Promise<void>((resolve, reject) => {
    if (document.getElementById('gis-script')) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.id = 'gis-script';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.body.appendChild(script);
  });
};

export const initGoogleClient = async (apiKey: string) => {
  // 1. Init GAPI Client (for API calls)
  await new Promise<void>((resolve, reject) => {
    gapi.load('client', () => {
      gapi.client.init({
        apiKey: apiKey,
        discoveryDocs: DISCOVERY_DOCS,
      }).then(() => resolve()).catch(reject);
    });
  });

  // 2. Load GIS (for Auth)
  await loadGisScript();
};

export const initTokenClient = (clientId: string, callback: (tokenResponse: any) => void) => {
  // @ts-ignore
  return google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file',
    callback: (tokenResponse: any) => {
      if (tokenResponse && tokenResponse.access_token) {
        // Manually set the token for gapi client
        // @ts-ignore
        gapi.client.setToken(tokenResponse);
        callback(tokenResponse);
      }
    },
  });
};

export const restoreToken = (token: any) => {
    // @ts-ignore
    gapi.client.setToken(token);
};

export const revokeToken = (token: string) => {
  // @ts-ignore
  google.accounts.oauth2.revoke(token, () => {
    console.log('Token revoked');
  });
};
