DROP TABLE IF EXISTS enhancement;
CREATE TABLE enhancement (
    id BIGINT PRIMARY KEY,
    requesttime TIMESTAMP NOT NULL,
    /* max length of TEXT: 2^14=16,384 chars in UTF-8 */
    username TEXT NOT NULL,
    url TEXT NOT NULL,
    /* max length of TINYTEXT: 2^6=64 chars in UTF-8 */
    language TINYTEXT NOT NULL,
    topic TEXT NOT NULL,
    activity TEXT NOT NULL,
    version TINYTEXT NOT NULL,
    /* max length of LONGTEXT: 2^30=1,073,741,824 chars in UTF-8 */
    enhancedspans LONGTEXT NOT NULL,
    originalpage LONGTEXT NOT NULL);
