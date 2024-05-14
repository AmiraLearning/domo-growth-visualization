# domo-growth-visualization

## Setup
1. Clone the repository: `git clone https://github.com/your-username/domo-growth-visualization.git`
2. Navigate to the project directory: `cd domo-growth-visualization`
3. Install dependencies: `npm install`
- NOTE: For development, `postinstall` copies `domo.js` to the project's root directory for `index.html` to include.  When changes are deployed, `domo publish` ignores `domo.js` because it's delivered by the Domo instance


4. Connect to DOMO
 - Install [DOMO Apps CLI](https://developer.domo.com/portal/6hlzv1hinkq19-setup-and-installation#step-1-install-the-domo-apps-cli)
  - Run `domo login`
  - Enter DOMO instance `amiralearning.domo.com`
  - Complete authentication in browser window.  If browser doesn't open automatically, use the link provided in the console output
  - After authentication, you device will remain signed into your account until you choose to sign out by running the `domo logout` command

## Development
1. Start the development server: `domo dev`
2. Open your browser and navigate to `http://localhost:3000` to view the application.
3. Make changes to the code and the browser will automatically reload with the updated changes.

## Deployment
1. Publish changes to production: `domo publish`
