const fs = require('fs');
const supabaseConfigPath = 'i:/Il mio Drive/drive/Antigravity/Preventivi/Preventivi_v2.5/supabase-config.js';
let configContent = fs.readFileSync(supabaseConfigPath, 'utf8');

const urlMatch = configContent.match(/const\s+supabaseUrl\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = configContent.match(/const\s+supabaseAnonKey\s*=\s*['"]([^'"]+)['"]/);

if (urlMatch && keyMatch) {
    async function checkSubs() {
        try {
            const resp = await fetch(urlMatch[1] + '/rest/v1/magazzino_push_subs?select=*', {
                headers: {
                    'apikey': keyMatch[1],
                    'Authorization': 'Bearer ' + keyMatch[1]
                }
            });
            const data = await resp.json();
            console.log("SUBSCRIPTIONS FOUND:", data.length);
            console.log(data);
        } catch(e) {
            console.log("Fetch error", e);
        }
    }
    checkSubs();
} else {
    console.log("Could not find supabase credentials in config.");
}
