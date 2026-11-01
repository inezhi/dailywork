# 代码生成与本地检查。
# 服务跑起来之前，这里只有契约相关目标；up/down/test/migrate 等切片开始后再加。
#
# 依赖两个命令行工具，版本写在 README 的「工具版本」一节，升级时一起改：
#   kitex        v0.16.3   （已内嵌 thriftgo，不需要单独装）
#   oapi-codegen v2.8.1

KITEX ?= kitex
OAPI  ?= oapi-codegen
MODULE := github.com/inezhi/dailywork

THRIFT_ENTRY := api/thrift/v1/dailywork.thrift
OPENAPI_ENTRY := api/openapi/v1/openapi.yaml
OPENAPI_CONFIG := api/openapi/oapi-codegen.yaml

.PHONY: codegen codegen-check build vet up down down-v ps

COMPOSE := docker compose -f deploy/docker-compose.yml --env-file deploy/.env

## codegen: 从 IDL 生成 Go 代码（Thrift → api/gen，OpenAPI → api/gen/http）
codegen:
	$(KITEX) -module $(MODULE) -gen-path api/gen $(THRIFT_ENTRY)
	$(OAPI) -config $(OPENAPI_CONFIG) $(OPENAPI_ENTRY)

## codegen-check: 重新生成并确认 api/gen 没有差异；有差异说明生成代码没提交
codegen-check:
	@$(MAKE) --no-print-directory codegen
	@git diff --exit-code -- api/gen \
		|| { echo "生成代码有漂移：请提交 api/gen 的改动"; exit 1; }

## build: 编译全部 Go 代码
build:
	go build ./...

## vet: 静态检查
vet:
	go vet ./...

## up: 起本地依赖（MySQL / Redis / Kafka），首次会执行 deploy/mysql/init
up:
	$(COMPOSE) up -d

## down: 停掉依赖，保留数据卷
down:
	$(COMPOSE) down

## down-v: 停掉并删除数据卷（清库，下次 up 会重新初始化）
down-v:
	$(COMPOSE) down -v

## ps: 看依赖容器状态
ps:
	$(COMPOSE) ps
