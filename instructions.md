# THOTH modular update

I am developing a web app for aton called thoth. Only modify thoth's codebase, not aton's source code. Read ATON's source code only when necessary.

Currently, thoth is programmed to only work when integrated with HESTIA, a different service which serves the API, and using EGI's login system. These changes were made over the last few thoth commits (7-8 commits if I'm not mistaken). 

My goal is to be able to deploy thoth in a modular way that allows partial integration of components for deployment and development. Specifically, I want the following options:

1. Fully local deployment using ATON's default api and authentication, when thoth is deployed through ATON's `npm start` / `pm2 start`.
2. Fully local deployment using ATON's default api and authentication, in a dockerized fashion. 
3. Deployment using HESTIA's api and HESTIA/EGI authentication when deployed with doecker.

For options 2 and 3, I want a simple way to pick one of the two deployment modes.

For option 3, there are two authentication modes: one through the EGI login implemented in this commit and one using HESTIA's SSO cookie login via redirection. I want to have access to both, through the thoth login UI in this case: place two buttons instead of one, one logging you in with EGI and one through the HESTIA portal.

Generate a deployment md file which explicitly states how to deploy thoth in either setting.

Rearange filesand their contents according to deployemnt type in an intuitive way.

Make the local deployment the default docker method.