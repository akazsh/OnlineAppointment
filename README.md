# Goodspace

Goodspace is an appointment booking app for customers and independent service providers. Customers can browse practices, check availability, book and cancel visits. Providers can publish a listing and manage their appointments.

## Run on Windows

1. Install Node.js 18 or newer and PostgreSQL.
2. Double-click `run.bat`. It installs Node dependencies on the first run and creates the `appointmentsystem` database when the PostgreSQL account has permission.
3. If PostgreSQL asks for credentials, open the generated `.env` file and set `PGUSER`, `PGPASSWORD`, and `PGDATABASE` to match your PostgreSQL installation. The default host and port are `localhost:5969`.
4. Run `run.bat` again and open `http://localhost:3000`.

You can also connect with a PostgreSQL connection URL by setting `DATABASE_URL` in `.env`. If your PostgreSQL account cannot create databases, create `appointmentsystem` yourself, or set `PGDATABASE` to a database that already exists.

## Local configuration

The launcher copies `.env.example` to `.env` the first time it runs. `.env` is local configuration and should not be committed. The application creates its tables and a small set of sample provider listings at startup.

Set a private, random `SESSION_SECRET` before exposing the app beyond your local machine. The sample listings are for browsing; create your own customer account to book, or register as a provider to publish a practice.

## Stack

- Node.js and Express
- PostgreSQL (`pg`)
- Browser-native HTML, CSS, and JavaScript

## Jenkins build

Create a Pipeline job configured to use this repository and select **Pipeline script from SCM**. The root-level `Jenkinsfile` installs locked dependencies, checks the server syntax, and archives the generated `.tgz` package. The Jenkins agent must have Node.js 18 or newer and npm available on `PATH`; no Jenkins NodeJS plugin is required. Both Windows and Unix agents are supported.