- create frontend and backend folders. 
    create vite@latest in the frontend, and npm init -y and 
    dep installation on the backend:

         npm i express@5.2.1 dotenv@16.4.7 cors@2.8.5 @clerk/express@2.1.0 @clerk/backend@3.2.8 @imagekit/nodejs@7.4.0 @sentry/node@10.48.0 @sentry/profiling-node@10.48.0 drizzle-orm@0.39.3 pg@8.13.1 standardwebhooks@1.0.0 stream-chat@8.57.6 zod@3.24.2

         npm i --save-dev @types/express@5.0.6 @types/node@22.10.10 @types/pg@8.11.10 drizzle-kit@0.30.4 tsx@4.19.2 typescript@5.7.3    
 
- create folders for src 
- setup env vars
- set up scripts in Backends/package.json for index.ts      
        ##     "dev": "tsx watch src/index.ts",
        ## works like nodemon since were using the watch command

- setup git 
- create database schema. using drizzle ORM for ease. 
    define users and products table


