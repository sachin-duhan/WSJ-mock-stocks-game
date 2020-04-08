# MOCKSTOCKS - GAME APPLICATION

### A basic webapp for conducting a somewhat automated stock trading event.

## Dependencies

Install runtime and database.
```
	sudo apt-get install nodejs mongodb
```
Install express.
```
	npm install -g express
```

Install dependencies
```
	npm install
```

## Database setup

The database for the rounds is bundled [here.](https://drive.google.com/file/d/1MvRSpHPIIEWYkuFp20zpxklqy_h2ZjP_/view)

Import it

    cd "DownloadFolder"
    tar xvf market.tar.gz
    mongorestore -d market ./market
    
Download and run [Robot3T](https://robomongo.org/download) to manipulate the database easily.

## Usage

### Round information
All the information for the rounds is stored within the `rounds` collection in
the database. A typical round looks like:

    {
        "_id" : ObjectId("589a002d20692a659c7a5344"),
        "index" : 1,
        "prices" : {
                "BHARTIARTL" : 329,
                "HCLTECH" : 742.6,
                "HEROMOTOCO" : 3509,
                ...
        },
        "shares" : {
                "BHARTIARTL" : 100,
                "HCLTECH" : 100,
                "HEROMOTOCO" : 100,
                ...
        },
        "news" : [
                "Bharti Airtel slashes prepaid tariffs to compete with Jio.",
                "HCL felicitated at artificial intelligence summit in London.",
                "Hero MotoCorp to start production at Bangladesh plant next year.",
                ...
        ],
        "duration" : 120,
        "active" : false
    }

Changing the information in this document will change the round info displayed
to the user.

### Choosing which round to run next

The app selects the round which has the `active` field set to `true` in the
database. During normal round progression, the app normally updates the round
with the next index by setting `active: true`. This behaviour can be overriden
by manipulating the database, in case of re-running a round due to failuers.

### Triggering the round start

The app uses console I/O instead of a separate admin panel to control the game.
When all clients are ready, enter 2 at the admin console to start the currently
active round. All clients will instantaneously start the round with the timer
ticking and the round will end according the duration (in seconds) set in the
round document within the collection.


# AUTHOR
```
NAME - SACHIN DUHAN
TEAM - MATHEMATICS AND COMPUTING SOCIETY - DTU
```

