#!/bin/bash

# tomcat has traditionally been run by heli on this machine
# run this script using heli's user to make sure that 
# environment variables are set correctly for the server
# sudo -u heli sh -x /home/ruskonteaksta/EduardVIEW/startup.sh

#export CATALINA_HOME=/usr/share/tomcat/apache-tomcat-7.0.39
#export JAVA_HOME=/usr/lib/jvm/java-openjdk
#export JRE_HOME=/usr/lib/jvm/java-1.7.0-openjdk
export LD_LIBRARY_PATH=/usr/local/lib
#export PATH="/usr/share/apache-maven/apache-maven-3.0.5/bin:/usr/lib/jvm/java-openjdk/bin:/usr/lib64/ccache:/usr/local/bin:/usr/bin:/usr/local/sbin:/usr/sbin:/home/ruskonteaksta/.local/bin:/home/ruskonteaksta/bin:$PATH"

cd /home/ruskonteaksta/EduardVIEW/
pwd

sh /usr/share/tomcat/apache-tomcat-7.0.39/bin/startup.sh
