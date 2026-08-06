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
    create env variables for the frontend (in the frontend folder) and create .env.example file
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
        create a helper method to get role of user and to check roles in backend/src/lib/roles.ts

- setup render for deployment. Create and configure .dockerignore and Dockerfile for deployment.
    add logic in Backend/src/index.ts to serve both the frontend and the backend.
    add env vars to render

- service is shut down after 15 min of inactrivity setting up cron jobs for it to stay active
    install dep: cron@4.4.0 in the backend
    create cron.ts in Backend/src/lib/
    create /health endpoint in index.ts


- setup up routers for product, stream and me routes in index.ts
    create meRouter.ts in and productRouter.ts in Backend/src/routes    
    - create Backend/src/lib/users.ts (use frequently so it gets a seperate file).
    create methods for productRouter in Backend/src/controllers/productController.ts
    
    -create stream router in Backend/src/routes/streamRouter.ts
        create helper in Backend/src/lib/stream.ts
        create methods for streamRouter.ts in Backend/src/controllers/streamController.ts

- create endpoint for payments (create router for checkouts)
- setup polar secrets and test product id in the backend env
- create checkoutController for the checkoutRouter
- create backend/src/lib/polar.ts helper for checkoutRouter



- create webhooks for polar
    create polar webhook handler in Backend/src/webhooks/polar.ts
    ensure that index.ts has the route for the polar webhook handler 



