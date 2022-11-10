
## What is it?
This thing is a stupid GPS tracker as it is :)
A client that is running on an Android device, tracking its position using geolocation services and sending it to the server, and an observation interface, that draws object point on the map with specified coordinates.
Why reinventing a wheel? Well, first of all, just for fun :) Second, this was developed for reality action quest games project in my hometown, so we needed a tracker that allows:
- watching the position without registration, installing any software, etc. by just having a URL and using an ordinary web browser 
- working on very unstable network channels (like EDGE or even simple GPRS, because sometimes quest games can be somewhere in the outskirts of the world)
- hiding the objects on the map when they are in some areas, or hiding them depending on specified time limits (like the objects are visible for one minute, and are hidden for one minute after that), and so on, depending on the quest scenario.
So that's why this project was created.

## Technologies
The first version used [MQTT](http://mqtt.org/) (a widely used protocol for IoT devices) and the protocol based on Google's [Protobuf](https://developers.google.com/protocol-buffers/?hl=ru), and mqtt-via-websockets for a front-end. This allowed to run everything without a backend, simply using mqtt broker (I used [mosquitto](https://mosquitto.org/)) and a static website. This version is in 'mqtt_protobuf_legacy' git branch.
This also required making some improvements and bugfixes in cordova-plugin-mqtt ([1](https://github.com/arcoirislabs/cordova-plugin-mqtt/pull/41), [2](https://github.com/arcoirislabs/cordova-plugin-mqtt/pull/42))

In the second version, I switched to a custom binary UDP-based protocol, that allowed me to avoid TCP retransmissions of non-actual data, and reduce the size of data packets. This also required developing  a small backed for it :) The channel between the backend and frontend is websockets.
The mobile client is written in HTML/JS with [Apache Cordova](https://cordova.apache.org/) framework, and [Vue.js](https://vuejs.org/) for the interface.
The backend uses NodeJS.
The frontend uses [leaflet](https://leafletjs.com/) library to render the map, with Mapbox tiles (actually, Mapbox can be easily switched to OpenStreetMap).
I also use [Nginx](https://nginx.org/) as a reverse-proxy to serve static HTML/JS/CSS files, redirect Websockets connections to backend port and to cache map tiles.

## How to build and start
### Backend:

The prefered way is to use docker, but you can also build and install it manually.

Docker approach will download NodeJS and all npm dependencies and start the app, It will also download Nginx and use pre-defined configuration for caching and websocket proxying.

First, git clone everything to your local filesystem. Then,

    $ cd server
    # edit docker-compose.yml file, you nay need to change the HTTP or client port for example
    # edit nginx/default.conf file, e.g. to use OSM or Mapbox, and specify your token if you are using Mapbox
    $ docker-compose up -d

Wait for a while, after it you will have a web server up and running.

Nginx configuration and HTML files are mounted to the docker as "bind mounts" so that you can make any changes you need in them (e.g. add TLS configuration into Nginx, or change some styles in HTML files).

Manual set up:

in 'server/bin/index.js' specify the ports for receiving clients' data and for WS connections from the front-end:

    const  emitterPort  =  8089
    const  receiverPort  =  8090

in 'server/www/index.js' put you domain/ip-port to 'connectURL'  constant

    const connectURL = (window.location.protocol != "https:" ? "ws://" : "wss://") + location.host + "/ws"

If you don't use Nginx as reverse-proxy, you may need to remove "/ws" postfix but add a port number to the 'location.host' instead. If you want to use Nginx, refer to 'server/nginx/default.conf' as a configuration example.
If you don't want to use Nginx, you can serve static content  using any web server like node ['static-server'](https://www.npmjs.com/package/static-server) or even [python](https://docs.python.org/2/library/simplehttpserver.html).

Server build and start:

    $ cd server/bin
    $ npm install

You will also need to download leaflet.js and lealet.css from Leaflet website or any CDN mirror and place it into 'server/www' directory.

And then

    $ node ./index.js

or you can install 'forever' (npm --install-g forever) and start backend using 

    $ ./start.sh

script.

### Client:

    $ sudo apt install gradle
    $ sudo npm install -g cordova
    $ cd client
    $ npm install
    $ npm run prepare // this will make some preparations
    $ cordova platform add android
    $ cordova requirements

This will tell you, what to you need to make a build.
Install dependencies:

    $ sudo apt-get install openjdk-8-jdk openjdk-8-jre
    $ sudo update-java-alternatives -s java-1.8.0-openjdk-amd64
    $ export JAVA_HOME=/usr/lib/jvm/java-1.8.0-openjdk-amd64
    // (Java 8 works perfectly, newer versions can have some issues with Cordova and Android)

Additionally you'll need Android SDK and Android Platforms. You can install them manually, but I prefer using [Android Studio](https://developer.android.com/studio), because it also helps with debugging:
unzip Android studio, cd bin, run ./studio.sh
Go to 
Android Studio -> Tools -> SDK Manager, select required SDK version and install it.
If the ANDROID_HOME environment variable is not set, set it manually

    $ export ANDROID_HOME=/home/user/Android/Sdk/
    $ export PATH=$PATH:$ANDROID_SDK_ROOT/platform-tools/
    $ export PATH=$PATH:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/
    $ export PATH=$PATH:$ANDROID_SDK_ROOT/emulator/

After that check again that everything is present:

    $ cordova requirements

If something is not okay, refer to [Cordova Android documantation](https://cordova.apache.org/docs/en/11.x/guide/platforms/android/) for setup instructions.

and run

    $ cordova build android

It will generate an unsigned debug .apk file in 'platforms/android/app/build/outputs/apk/debug/' that is enough for debugging and personal use. Generating signed release .apk is a special question, please refer to Cordova official manual and StackOverflow for it :)

## Known issues
It doesn't send any data when the app is in the background or the screen is off - these are the limitation of Android platform. Well, it used to work some time ago (in the epoch of Android ~6) and I used a number of Cordova plugins for it (like insomnia, power-management, etc.), but it doesn't work as expected now. 

## Todo
- Try to use [cordova-plugin-background-geolocation](https://github.com/mauron85/cordova-plugin-background-geolocation) to fix the sleep issue
- Support multiple objects on the map. Client already has "object ID" setting, and the protocol includes a field for it, but front-end can't draw more than one point for now.
