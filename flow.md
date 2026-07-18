- create frontend and backend folders. 
    create vite@latest in the frontend, and npm init -y and 
    dep installation on the backend:

         npm i express@5.2.1 dotenv@16.4.7 cors@2.8.5 @clerk/express@2.1.0 @clerk/backend@3.2.8 @imagekit/nodejs@7.4.0 @sentry/node@10.48.0 @sentry/profiling-node@10.48.0 drizzle-orm@0.39.3 pg@8.13.1 standardwebhooks@1.0.0 stream-chat@8.57.6 zod@3.24.2

         npm i --save-dev @types/express@5.0.6 @types/node@22.10.10 @types/pg@8.11.10 drizzle-kit@0.30.4 tsx@4.19.2 typescript@5.7.3    
 
- create folders for src 
- setup env vars for sentry, neon, stream, clerk and imagekit
- set up scripts in Backends/package.json for index.ts      
        ##     "dev": "tsx watch src/index.ts",
        ## works like nodemon since were using the watch command

- setup git 
- create database schema. using drizzle ORM for ease. 
    define users, products, orders, orderItems and checkoutSessions table.
    define relations for the users, products and orders tables. 
    setup db pool and create the "drizzle.config.ts" file. 
    add script in package.json for db:push to neon.

- setup auth with clerk
    install clerk dep for frontend : 
        npm install @clerk/react
    create env variables for the frontend
    follow clerk docs to integrate clerk to the frontend:
        https://clerk.com/docs/react/getting-started/quickstart
- new sign ups with clerk wont automatically show up on neon db. Need to set up a webhook {automated msg thats sent when something happens ie: a user being created}  
    clerk has events which include- user.created, user.updated and user.deleted       
    using https://neobuy-test.com/webhooks/clerk as test url for endpoint url,  will change on deployment. (clerk will send a post request on the route "/webhooks/clerk")
    [chose neobuy-test.com as app domain at whim may change later]
    subscribe to needed events on clerk dashboard [ configure -> developers -> webhooks]
    add env var for webhook in the backend
    
    tangent:
    setup backend/src/index.ts with middlewares etc
        fix cors using:  
            npm i --save-dev @types/cors

    Ensure validation for env variables:        
    setup and use zod for env vars
        create backend/src/lib/env.ts
        write envSchema for zod, and setup loadEnv and getEnv functions.


- setup logic for clerkWebhookHandler in backend/src/webhooks/clerk.ts
        





