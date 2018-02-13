echo "Running 'mvn package'..."
mvn package -o
echo "Running 'touch src/main/webapp/WEB-INF/web.xml'..."
touch src/main/webapp/WEB-INF/web.xml
echo "Running 'mvn war:exploded'..."
mvn war:exploded -o
echo "Run the following:"
echo "sudo chown heli:oahpa target -R"
