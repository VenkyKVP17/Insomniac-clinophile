import { defineEventHandler, getQuery, sendRedirect } from 'h3'
import fs from 'fs'
import path from 'path'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const code = query.code
  const state = query.state
  
  if (code) {
    const vaultPath = '/home/ubuntu/vp'
    const oauthUrlFile = path.join(vaultPath, 'OAUTH_URL.txt')
    
    // Construct the full URL that the monitor expects
    const fullUrl = `https://localhost/?state=${state}&code=${code}`
    fs.writeFileSync(oauthUrlFile, fullUrl)
    
    // Redirect user to a success page or dashboard
    return sendRedirect(event, 'https://nyx.katthan.online/success', 302)
  }
  
  return { error: 'No code received' }
})
