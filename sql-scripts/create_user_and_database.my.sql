/* 
 * Run this MySQL script as root in MySQL to create a user and database for
 * VIEW. It contains MySQL-specific commands, so it cannot be used with other
 * SQL implementations.
 */
CREATE DATABASE wertiview DEFAULT CHARACTER SET utf8 DEFAULT COLLATE utf8_general_ci;
/* (yes, we really need both 'localhost' and '%') */
CREATE USER 'wertiview'@'localhost' IDENTIFIED BY 'bu2hAsEw';
CREATE USER 'wertiview'@'%' IDENTIFIED BY 'bu2hAsEw';
GRANT ALL PRIVILEGES ON wertiview.* TO 'wertiview'@'%';
