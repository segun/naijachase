-- DBA provisioning template: replace password and host before executing.
-- Keep this secret exclusively in shared/migrations.env on the deployment host.
CREATE USER 'naijachase_migrate'@'localhost' IDENTIFIED BY 'REPLACE_WITH_UNIQUE_MIGRATION_SECRET' REQUIRE SSL;
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES
    ON naijachase.* TO 'naijachase_migrate'@'localhost';
SHOW GRANTS FOR 'naijachase_migrate'@'localhost';
