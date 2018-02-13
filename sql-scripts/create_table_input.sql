DROP TABLE IF EXISTS input;
CREATE TABLE input (
    id BIGINT PRIMARY KEY,
    enhId BIGINT REFERENCES enhancement.id,
    requesttime TIMESTAMP NOT NULL,
    wertiviewspanid INT NOT NULL,
    wertiviewtokenid TEXT NOT NULL,
    userinput TEXT NOT NULL,
    countsascorrect BOOLEAN NOT NULL,
    /* these two are NULL in the click activity */
    correctanswer TEXT,
    usedhint BOOLEAN);
