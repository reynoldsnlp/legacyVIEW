# VIEW

This file should get you going on installing VIEW. Please ask if something
seems unclear, I will try to keep the documentation as clean as possible.

## Installation instructions

VIEW runs on Apache Tomcat version 5 or higher. Version 6 or higher is
recommended.

### Building requirements

* A recent [Tomcat](http://tomcat.apache.org/download-60.cgi) (5 or higher, 
6 recommended)
* Peripherals, like `mvn` (maven).

#### Notes
The logging configuration is in `WEB-INF/classes/log4j.properties`

### Eclipse

If you want to get VIEW running in Eclipse, also consult the documentation in 
`docs/eclipse-setup-for-view.txt`.


## Preparation

Setup the directory `/usr/local/werti` following the instructions in 
`docs/usr-local-werti.txt`.

## Building

After everything is in place, just go ahead and type

	mvn package

This will take a while. A *lot* of dependencies will be downloaded. Make sure 
you have a good Internet connection and some coffee (or other favored 
beverage).

## Deploying

While VIEW may run on other Servlet containers, it has so far only been tested 
with Tomcat 6.x. There are several ways of deploying the application.

### Local Development: Using Symlinks

If VIEW is installed to your local system, then placing a symlink from
`$CATALINA_HOME/webapps` to `target/VIEW` is the easiest way to deploy VIEW
on your local development server. You can use the `mvn war:exploded` tasks to
redeploy the application this way. Note that Tomcat will require you to `touch`
VIEW's `web.xml` for it to notice a change and reload.

### Local Development: Using the Maven Tomcat Plug in

Maven's Tomcat Plug in can deploy webapps on a local or remote tomcat server.
See the [documentation for
deploying](http://mojo.codehaus.org/tomcat-maven-plugin/deployment.html) and
the [usage and configuration
documentation](http://mojo.codehaus.org/tomcat-maven-plugin/usage.html) on the
official site.

### System-specific locations (Runtime)

The file `src/main/webapp/WERTi.properties` contains runtime paths and 
adjustments that control the default behaviour of the VIEW server-side code. 
Currently, it mainly contains paths to model files and executables of external 
tools (e.g., TreeTagger). You may need to adjust a few paths if your models/ 
executables are in different locations or if you are using different versions 
of them (e.g., the 32-bit version of RFTagger).

* `this-server`: You will probably have to change this if you are deploying 
VIEW to a different host or port. (May be outdated, was related to GWT, which 
is no longer used.)

### Server settings of new VIEW (Version 1.0)
In "VIEW/src/main/resources/firefox-extension/viewWE/manifest.json"
change under "permissions" the url of the server currently set to
"*://localhost/*". Replace "localhost" with your server address
to permit the extension to communicate with your server.

In "/VIEW/src/main/resources/firefox-extension/viewWE/content_scripts/view.js"
and "/VIEW/src/main/webapp/js-lib-viewWE/view.js" 
change "localhost:8080" in
"serverURL: "http://localhost:8080/VIEW",
servletURL: "http://localhost:8080/VIEW/VIEW"," 
to your server address, so that the extension can send ajax requests to your server.

In "/VIEW/src/main/webapp/openid/authenticator.html"
change "localhost:8080" in
"http://localhost:8080/VIEW/index.jsp?content=firefox-extension"
to your server address, so that the user is redirected to the terms of service 
of your server.
