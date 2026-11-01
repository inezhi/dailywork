#!/bin/sh
# 首次启动时建库与账号。M1 只有一个服务（DailyWorkService），所以只有一个库。
# 只在数据卷为空时执行一次；改了这里要 make down-v 重建才生效。
set -e

mysql -uroot -p"$MYSQL_ROOT_PASSWORD" <<EOSQL
CREATE DATABASE IF NOT EXISTS dailywork
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'dailywork'@'%' IDENTIFIED BY '${MYSQL_APP_PASSWORD}';
GRANT ALL PRIVILEGES ON dailywork.* TO 'dailywork'@'%';

FLUSH PRIVILEGES;
EOSQL
