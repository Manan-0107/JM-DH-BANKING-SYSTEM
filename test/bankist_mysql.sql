CREATE DATABASE IF NOT EXISTS `bankist`;
USE `bankist`;

-- Drop existing tables if they exist
DROP TABLE IF EXISTS `transactions`;
DROP TABLE IF EXISTS `accounts`;
DROP TABLE IF EXISTS `customers`;

-- Create customers table
CREATE TABLE `customers` (
  `customer_id` VARCHAR(50) PRIMARY KEY,
  `full_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) UNIQUE NOT NULL,
  `phone` VARCHAR(20),
  `dob` DATE,
  `address` TEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('Active', 'Blocked') DEFAULT 'Active',
  `kyc_status` ENUM('Verified', 'Pending') DEFAULT 'Pending',
  `password_hash` VARCHAR(255) NOT NULL,
  `credit_score` INT DEFAULT 700,
  `tier` ENUM('Silver', 'Gold', 'Platinum', 'VIP') DEFAULT 'Silver'
);

-- Create accounts table
CREATE TABLE `accounts` (
  `account_number` VARCHAR(50) PRIMARY KEY,
  `customer_id` VARCHAR(50) NOT NULL,
  `account_type` ENUM('Savings Account', 'Current Account', 'Fixed Deposit') NOT NULL,
  `balance` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `ifsc_code` VARCHAR(20) NOT NULL DEFAULT 'BNKST0001',
  `branch_name` VARCHAR(100) NOT NULL DEFAULT 'Downtown Central',
  `opening_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('Active', 'Frozen', 'Closed') DEFAULT 'Active',
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`customer_id`) ON DELETE CASCADE
);

-- Create transactions table
CREATE TABLE `transactions` (
  `transaction_id` VARCHAR(50) PRIMARY KEY,
  `sender_account` VARCHAR(50) NULL,
  `receiver_account` VARCHAR(50) NULL,
  `amount` DECIMAL(15,2) NOT NULL,
  `type` ENUM('Deposit', 'Withdrawal', 'Transfer') NOT NULL,
  `date_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('Success', 'Failed', 'Pending') DEFAULT 'Success',
  `description` TEXT
);

-- Insert customers data
INSERT INTO `customers` VALUES 
('CUST-101','Aarav Lynn','aarav@example.com','+1-555-0101','1990-03-15','123 Main St, San Francisco, USA','2024-01-10 09:00:00','Active','Verified','$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC',810,'Platinum'),
('CUST-102','Miyah Miles','miyah@example.com','+44-20-5550102','1995-07-22','45 Kings Road, London, UK','2024-02-14 10:30:00','Active','Verified','$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC',760,'Gold'),
('CUST-103','Francisco Gomes','francisco@example.com','+351-21-5550103','1988-11-05','78 Rua Augusta, Lisbon, Portugal','2024-03-01 14:15:00','Active','Verified','$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC',790,'Platinum'),
('CUST-104','Elena Rostova','elena@example.com','+1-555-0104','1992-09-18','200 Lake Shore Dr, Chicago, USA','2024-04-20 11:00:00','Active','Pending','$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC',745,'Silver'),
('CUST-105','Liam Chen','liam@example.com','+1-555-0105','1985-01-30','99 Tech Blvd, Austin, USA','2024-05-05 08:45:00','Active','Verified','$2a$10$Ae9nKPkrHJQQuBilwJdDxOaL.heCr7mtxFh9GeDd7Liwem7yvWekC',830,'VIP'),
('CUST-106','Dhrumil','dhrumilchaudhary10@gmail.com',NULL,NULL,NULL,'2026-08-17 15:19:52','Active','Pending','$2a$10$1VpnRbnNJLM98GtPvAS5auM4WJSSsKzVV.xFpAh1DsUIl7ZPNqu9y',700,'Silver'),
('CUST-107','Dhrumil','dhrumilchaudhary11@gmail.com',NULL,NULL,NULL,'2026-08-17 15:28:53','Active','Pending','$2a$10$drsQlUd1blHRyLGp.puFE.8K84Z43pQRq6ZK5OamRIg8OJyLLF4Sy',700,'Silver'),
('CUST-108','Dhrumil Patel','dhrumilchaudhary1@gmail.com',NULL,NULL,NULL,'2026-08-18 04:39:50','Active','Pending','$2a$10$EFO5GCVbdycWUmfLwkTalOKTEYUJJRGk7otKhCyu0ugoNjoWE7mE2',700,'Silver'),
('CUST-109','Het nasit','dhrumilchaudhary50@gmail.com',NULL,NULL,NULL,'2026-08-19 05:46:55','Active','Pending','$2a$10$FBLBqj72ahtu4fOeP7DfQuhlYk4uksuYwUEYmcbdwiAr2/Fu3GvMa',700,'Silver');

-- Insert accounts data
INSERT INTO `accounts` VALUES 
('ACC-883921','CUST-104','Savings Account',142500.0,'BNKST0001','Downtown Central','2024-01-15 09:00:00','Active'),
('ACC-772910','CUST-101','Current Account',28430.5,'BNKST0001','Bay Ridge Hub','2024-02-20 10:30:00','Active'),
('ACC-664019','CUST-103','Savings Account',95120.0,'BNKST0002','Financial District','2024-03-10 14:15:00','Active'),
('ACC-553102','CUST-102','Savings Account',3850.75,'BNKST0001','Metro Plaza','2024-04-25 11:00:00','Active'),
('ACC-442991','CUST-105','Current Account',210000.0,'BNKST0003','Tech Quarter','2024-05-10 08:45:00','Active'),
('ACC-300364','CUST-106','Savings Account',0.0,'BNKST0001','Downtown Central','2026-08-17 15:19:52','Active'),
('ACC-261282','CUST-107','Savings Account',0.0,'BNKST0001','Downtown Central','2026-08-17 15:28:53','Active'),
('ACC-183846','CUST-108','Savings Account',0.0,'BNKST0001','Downtown Central','2026-08-18 04:39:50','Active'),
('ACC-962111','CUST-109','Savings Account',0.0,'BNKST0001','Downtown Central','2026-08-19 05:46:55','Active');

-- Insert transactions data
INSERT INTO `transactions` VALUES 
('TXN-00000001',NULL,'ACC-883921',50000.0,'Deposit','2024-06-01 09:00:00','Success','Initial deposit'),
('TXN-00000002',NULL,'ACC-772910',15000.0,'Deposit','2024-06-02 10:30:00','Success','Salary credit'),
('TXN-00000003','ACC-772910','ACC-664019',5000.0,'Transfer','2024-06-05 14:00:00','Success','Payment to Francisco'),
('TXN-00000004','ACC-442991',NULL,2000.0,'Withdrawal','2024-06-08 16:30:00','Success','ATM withdrawal'),
('TXN-00000005',NULL,'ACC-553102',1200.0,'Deposit','2024-06-10 11:15:00','Success','Monthly allowance'),
('TXN-00000006','ACC-883921','ACC-553102',3000.0,'Transfer','2024-06-15 13:45:00','Success','Gift transfer'),
('TXN-00000007','ACC-664019',NULL,10000.0,'Withdrawal','2024-06-18 09:30:00','Success','Rent payment'),
('TXN-00000008',NULL,'ACC-442991',75000.0,'Deposit','2024-06-20 10:00:00','Success','Business income'),
('TXN-00000009',NULL,'ACC-300364',500.0,'Deposit','2026-08-19 06:00:29','Success','Online Deposit'),
('TXN-00000010','ACC-300364',NULL,500.0,'Withdrawal','2026-08-19 06:06:55','Success','Online Withdrawal');

-- Create Indexes
CREATE INDEX idx_accounts_customer ON accounts(customer_id);
CREATE INDEX idx_transactions_sender ON transactions(sender_account);
CREATE INDEX idx_transactions_receiver ON transactions(receiver_account);
CREATE INDEX idx_transactions_datetime ON transactions(date_time);

COMMIT;
