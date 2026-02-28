import jaydebeapi
import jpype
import os
from dotenv import load_dotenv
load_dotenv()

#JAR_PATH = "/app/driver/mssql-jdbc-12.10.1.jre11.jar"
# JAR_PATH = "web_server\driver\mssql-jdbc-12.10.1.jre11.jar"
JAR_PATH = r"E:\TestIoT\NT2203.CH20-C-ng-ngh-IoTs-n-ng-cao\Project_Weather_Station\web_server\driver\mssql-jdbc-12.10.1.jre11.jar"
def start_jvm():
    if not jpype.isJVMStarted():
        jpype.startJVM(classpath=[JAR_PATH])

def get_connection():

    driver = "com.microsoft.sqlserver.jdbc.SQLServerDriver"

        
    jdbc_url = (
        "jdbc:sqlserver://weather-sql-250202042.database.windows.net:1433;"
        "database=weatherdb;"
        "encrypt=true;"
        "trustServerCertificate=false;"
        "hostNameInCertificate=*.database.windows.net;"
        "loginTimeout=30;"
    )
    username = os.getenv("DB_USER")
    password = os.getenv("DB_PASS")
    # print(f"Connecting to DB with user: {username}")
    # print(f"Connecting to DB with password: {password}")
    
    start_jvm()
        
    conn = jaydebeapi.connect(
        driver,
        jdbc_url,
        [username, password],
        JAR_PATH
    )

    return conn