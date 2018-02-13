import re, sys

myRE = re.compile( r'\s+0\.0$' )
for line in sys.stdin :
	sys.stdout.write( myRE.sub( '', line ) )
