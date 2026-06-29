const { execSync } = require("child_process");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

function getDeploymentDomain() {
  const raw =
    process.env.REPLIT_INTERNAL_APP_DOMAIN ||
    process.env.REPLIT_DEV_DOMAIN ||
    process.env.EXPO_PUBLIC_DOMAIN;

  if (!raw) {
    console.error(
      "ERROR: No deployment domain found. Set REPLIT_INTERNAL_APP_DOMAIN, REPLIT_DEV_DOMAIN, or EXPO_PUBLIC_DOMAIN",
    );
    process.exit(1);
  }

  return raw.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

const domain = getDeploymentDomain();
console.log(`Building Expo web export for domain: ${domain}`);

execSync("pnpm exec expo export --platform web", {
  cwd: projectRoot,
  env: {
    ...process.env,
    EXPO_PUBLIC_DOMAIN: domain,
  },
  stdio: "inherit",
});

console.log("Web export complete! Output in dist/");
