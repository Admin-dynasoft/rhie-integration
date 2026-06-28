<?php
error_reporting(1 | 0);
// require_once 'vendor/autoload.php';
define("DB_HOST", "127.0.0.1"); // set database host 
define("DB_USER", "root"); // set database user
define("DB_PASS", "raymond1"); // set database password
define("DB_NAME", "kirwa_437"); // set database name
$link = mysqli_connect(DB_HOST, DB_USER, DB_PASS) or die("Couldn't make connection.");
$db = mysqli_select_db($link, DB_NAME) or die("Couldn't select database");
date_default_timezone_set('Africa/Kigali');

class DBController
{
    private $host = "127.0.0.1";
    private $user = "root";
    private $password = "raymond1";
    private $database = "kirwa_437";
    private $conn;

    function __construct()
    {
        $this->conn = $this->connectDB();
    }

    function connectDB()
    {
        $conn = mysqli_connect($this->host, $this->user, $this->password, $this->database);
        return $conn;
    }

    function runQuery($query)
    {
        $result = mysqli_query($this->conn, $query);
        while ($row = mysqli_fetch_assoc($result)) {
            $resultset[] = $row;
        }
        if (!empty($resultset))
            return $resultset;
    }

    function numRows($query)
    {
        $result = mysqli_query($this->conn, $query);
        $rowcount = mysqli_num_rows($result);
        return $rowcount;
    }
}

class Databasee
{
    private $host = "127.0.0.1"; // Change if necessary
    private $db_name = "kirwa_437"; // Set your database name
    private $username = "root"; // Set your DB username
    private $password = "raymond1"; // Set your DB password
    public $link;

    public function getConnection()
    {
        $this->link = null;
        try {
            $this->link = new PDO("mysql:host=" . $this->host . ";dbname=" . $this->db_name, $this->username, $this->password);
            $this->link->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
            $this->link->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);
            $this->link->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        } catch (PDOException $exception) {
            echo "Connection error: " . $exception->getMessage();
        }
        return $this->link;
    }
}

class DBConnection
{
    private static $conn = null;

    public static function connect()
    {
        if (self::$conn === null) {
            self::$conn = new mysqli("127.0.0.1", "root", "raymond1", "kirwa_437");

            if (self::$conn->connect_error) {
                die("Connection failed: " . self::$conn->connect_error);
            }
        }
        return self::$conn;
    }
}

class Database
{
    private $host = "127.0.0.1";
    private $db_name = "kirwa_437";
    private $username = "root";
    private $password = "raymond1";
    public $conn;

    public function connect()
    {
        $this->conn = null;
        try {
            $this->conn = new PDO(
                "mysql:host=" . $this->host . ";dbname=" . $this->db_name,
                $this->username,
                $this->password
            );
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        } catch (PDOException $e) {
            echo "Connection Error: " . $e->getMessage();
        }
        return $this->conn;
    }
}
class OnlineDatabase
{
    private $host = "104.251.216.154";
    private $db_name = "rhie_medisoft_db";
    private $username = "root";
    private $password = "raymond1";
    public function connect(): PDO
    {
        try {
            $conn = new PDO("mysql:host={$this->host};dbname={$this->db_name};charset=utf8mb4", $this->username, $this->password, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
            return $conn;
        } catch (PDOException $e) {
            die("Online DB Connection Error: " . $e->getMessage());
        }
    }
}