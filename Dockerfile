# --- STAGE 1: BUILD THE REACT APPLICATION ---
# Use the Node.js 20 Alpine image for a small build environment
FROM node:20-alpine AS build-stage

# Set the working directory inside the container
WORKDIR /app

# Copy package files (for caching npm install)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all source files
COPY . .

# Write the GEMINI_API_KEY from the build argument into .env.local
# This is a safe way to inject an environment variable that needs to be known at BUILD time
ARG GEMINI_API_KEY
RUN echo "VITE_GEMINI_API_KEY=${GEMINI_API_KEY}" > .env.local

# Build the React app. 'dist' is the default output folder for Vite.
RUN npm run build


# --- STAGE 2: SERVE THE FINAL APPLICATION WITH NGINX ---
# Use the tiny Nginx Alpine image for serving the static files
FROM nginx:alpine AS production-stage

# Cloud Run expects your app to listen on the port specified by the PORT environment variable,
# but it defaults to 8080 if not set. We will explicitly use 8080 for Nginx.
ENV PORT 8080
EXPOSE 8080

# Remove the default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy the custom Nginx configuration file
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the final built files from the 'build-stage' into the Nginx serving directory
# Assuming your 'npm run build' outputs to a 'dist' folder. If not, change 'dist' below.
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Run Nginx in the foreground so the container doesn't exit immediately
CMD ["nginx", "-g", "daemon off;"]
