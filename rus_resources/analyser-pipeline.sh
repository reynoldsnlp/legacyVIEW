#!/bin/bash

timestamp="$1"

env 2>/tmp/tomcat-sh-envErr >/tmp/tomcat-sh-env

#sudo rm /tmp/VIEW-debug*
tee /tmp/VIEW-debug1 </home/ruskonteaksta/EduardVIEW/rus_output/cg3AnalyserInputFiles/cg3AnalyserInput${timestamp}.tmp | \
java -jar /home/ruskonteaksta/EduardVIEW/rus_resources/hfst-ol.jar /home/ruskonteaksta/EduardVIEW/rus_resources/analyser-gt-desc.ohfst 2>/dev/null | \
tee /tmp/VIEW-debug2 | tail -n+5 | \
tee /tmp/VIEW-debug2 | cut -f 1-2 | \
tee /tmp/VIEW-debug3 | cg-conv | \
tee /tmp/VIEW-debug4 | vislcg3 -g /home/ruskonteaksta/EduardVIEW/rus_resources/apertium-rus.rus.rlx | \
tee /tmp/VIEW-debug5 > /home/ruskonteaksta/EduardVIEW/rus_output/cg3AnalyserOutputFiles/cg3AnalyserOutput${timestamp}.tmp

#/bin/cat /home/ruskonteaksta/EduardVIEW/rus_output/cg3AnalyserInputFiles/cg3AnalyserInput${timestamp}.tmp | tee /tmp/VIEW-debug1 | java -jar /home/ruskonteaksta/EduardVIEW/rus_resources/hfst-ol.jar /home/ruskonteaksta/EduardVIEW/rus_resources/analyser-gt-desc.ohfst | tail -n+5 | tee /tmp/VIEW-debug2 | tee /tmp/VIEW-debug3 | /usr/local/bin/cg-conv | tee /tmp/VIEW-debug4 | /usr/local/bin/vislcg3 -g /home/ruskonteaksta/EduardVIEW/rus_resources/apertium-rus.rus.rlx | tee /tmp/VIEW-debug5 > /home/ruskonteaksta/EduardVIEW/rus_output/cg3AnalyserOutputFiles/cg3AnalyserOutput${timestamp}.tmp
