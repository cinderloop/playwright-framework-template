# Runs the suite in the official Playwright image. Keep the tag in lockstep with
# the @playwright/test version in package.json so browsers match the runner.
FROM mcr.microsoft.com/playwright:v1.64.0-noble

WORKDIR /tests
ENV CI=true

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .

ENTRYPOINT ["npx", "playwright", "test"]
