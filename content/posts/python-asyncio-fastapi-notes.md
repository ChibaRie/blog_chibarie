---
id: 24
title: "Python、asyncio 与 FastAPI：把面试八股文串成一条线"
slug: "python-asyncio-fastapi-notes"
date: "2026-10-22T17:06:00+08:00"
updated: "2026-10-22T17:06:00+08:00"
summary: "把 Python 基础、asyncio 和 FastAPI 的常见面试题整理成一条线：先搞清楚对象模型，再理解异步在调度什么，最后落到 FastAPI 的请求生命周期和工程实践。"
cover: "/uploads/2026/10/20261022-python-cover.gif"
category: "tech"
tags: ["Python","FastAPI","asyncio","面试","后端"]
isTop: false
draft: false
---
这篇是把两份材料揉在一起的笔记：一份是 Python/FastAPI 的常见面试题，另一份是 asyncio 的进阶语法。分开看都懂，合起来容易断片。比如 FastAPI 的 async 路由为什么不能直接调同步数据库，为什么 `gather` 能并发但一个个 `await` 就是串行，这些问题最后都落在同一处：Python 的对象模型和事件循环。

下面尽量按“对象模型 → 异步调度 → Web 请求”的顺序串，不按题库顺序背。

## 先把 Python 的对象模型搞清楚

### 四种基本容器，先看可变性

| 结构 | 可变 | 有序 | 可重复 | 典型用途 |
| --- | --- | --- | --- | --- |
| `list` | 是 | 是 | 是 | 顺序数据、频繁增删 |
| `tuple` | 否 | 是 | 是 | 常量、字典 key、返回值 |
| `dict` | 是 | 是（3.7+） | key 不可重复 | 键值查找、JSON |
| `set` | 是 | 否 | 否 | 去重、集合运算 |

列表最灵活；元组不可变，所以能当字典的 key；字典查找平均 O(1)；集合用来去重和交并差。真正要记住的不是表格，而是“可变对象不能做字典 key / 集合元素”，因为哈希值可能变。

Python 的类型也按可变性分：`int`、`float`、`bool`、`str`、`tuple`、`frozenset`、`bytes` 不可变；`list`、`dict`、`set`、`bytearray` 可变。不可变对象“修改”时其实是创建了新对象，这一点会直接影响函数传参和拷贝。

### 参数传递和可变默认值

Python 不是值传递，也不是引用传递，通常叫“传对象引用”。函数拿到的是对象的引用，行为取决于对象可不可变。

```python
def modify_int(x):
    x = 100

a = 1
modify_int(a)
print(a)  # 1

def modify_list(lst):
    lst.append(99)

b = [1, 2, 3]
modify_list(b)
print(b)  # [1, 2, 3, 99]
```

更常见的是可变默认参数的坑：

```python
def append_to(item, target=[]):  # 默认列表只创建一次
    target.append(item)
    return target

# 正确写法
def append_to(item, target=None):
    if target is None:
        target = []
    target.append(item)
    return target
```

默认值在函数定义时求值一次，之后所有调用共享同一个对象。只要默认值是可变对象，就会互相污染。

### 浅拷贝和深拷贝

```python
import copy

original = [[1, 2], [3, 4]]

shallow = copy.copy(original)
shallow[0].append(99)
print(original)  # [[1, 2, 99], [3, 4]]

deep = copy.deepcopy(original)
deep[0].append(88)
print(original)  # [[1, 2, 99], [3, 4]]
```

赋值只是多了一个引用；浅拷贝复制最外层，内部子对象仍然共享；深拷贝递归复制所有层级。切片 `[:]`、`list()`、`dict.copy()` 都是浅拷贝。只有不可变元素的列表，浅拷和深拷结果看起来一样；一旦嵌套了可变对象，区别就出来了。

### `is` 和 `==`

`==` 比较值，调用 `__eq__`；`is` 比较身份，等价于 `id(a) == id(b)`。

```python
a = [1, 2, 3]
b = [1, 2, 3]
c = a

print(a == b)  # True
print(a is b)  # False
print(a is c)  # True
```

实际开发里 `is` 基本只用于 `is None`、`is not None` 和单例判断。小整数（-5 到 256）和部分短字符串有缓存/驻留，可能让 `is` 出现“看起来对”的结果，但不能依赖。

### `return` 和 `yield`

`return` 结束函数并返回结果；`yield` 返回一个值后暂停函数，下次从暂停处继续。

```python
def squares_return(n):
    return [i ** 2 for i in range(n)]

def squares_yield(n):
    for i in range(n):
        yield i ** 2

gen = squares_yield(5)
print(next(gen))  # 0
print(next(gen))  # 1
```

`return` 一次性把数据放进内存；`yield` 是惰性求值，适合大文件、流式数据、管道处理。生成器函数调用后不会立刻执行，只有 `next()` / `for` 迭代时才往前走。

### 作用域、装饰器和对象模型

作用域查找遵循 LEGB：Local → Enclosing → Global → Built-in。函数内部能读外层变量，但要修改全局变量得 `global`，修改闭包外层变量得 `nonlocal`。

装饰器本质是“接收函数、返回新函数”的高阶函数：

```python
from functools import wraps

def timer(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        import time
        start = time.time()
        result = func(*args, **kwargs)
        print(func.__name__, time.time() - start)
        return result
    return wrapper
```

`@timer` 等价于 `my_func = timer(my_func)`。带参数的装饰器再套一层；记得用 `functools.wraps` 保留原函数名和 docstring。

OOP 三大特征：封装、继承、多态。Python 没有真正的私有属性，双下划线只是名称改写；多继承靠 MRO（C3）解决菱形问题；多态靠鸭子类型，不关心对象是什么类，只关心有没有对应方法。`__new__` 负责创建对象，第一个参数是 `cls`，必须返回实例；`__init__` 负责初始化，第一个参数是 `self`，不返回值。日常重写 `__init__` 就够了，`__new__` 多用于单例或继承不可变类型。

### 剩下的高频点

- `break` 跳出整个循环，`continue` 跳过本次迭代；都只影响最近一层循环。
- Python 3 的 `range` 是惰性可迭代对象，不再返回列表；`xrange` 已移除。
- `lambda` 只能写一个表达式，适合 `sorted(key=...)`、`map`、`filter` 这种短逻辑。
- 字符串拆分：`split()` 最常用，`rsplit()` 从右拆，`splitlines()` 按行拆，`partition()` 返回三元组，复杂规则用 `re.split()`。
- 单引号和双引号完全等价；三引号用于多行字符串和 docstring。
- 常用标准库：`os` / `sys` / `pathlib`、`json` / `re` / `csv`、`datetime`、`collections`、`functools`、`itertools`、`logging`、`asyncio`。
- `list` 是通用容器，可混类型、动态扩容；`numpy.ndarray` 是同类型连续内存，支持向量化和广播，适合数值计算。
- 编译型语言先编译成机器码再执行；Python 先编译成字节码，再由虚拟机解释执行，通常归类为解释型语言。

## asyncio：异步到底在调度什么

`asyncio` 解决的是 IO 密集型任务的并发问题，不是让 CPU 算得更快。它的核心是“协程 + 事件循环”：遇到 IO 等待时，协程主动让出 CPU，事件循环去调度别的就绪协程，IO 完成后再回来。

同步版本里，5 个各耗时 2 秒的请求是串行等待，总耗时约 10 秒；异步版本里，5 个任务可以同时挂起，总耗时接近 2 秒。差距来自“等待 IO 时有没有让出线程”，不是来自协程本身有多快。

### 协程、事件循环、Task、Future

- **协程**：`async def` 定义的函数，调用后返回协程对象，不会立刻执行。
- **事件循环**：调度器。负责注册协程、监听 IO、切换挂起任务、处理定时器。
- **可等待对象**：`await` 右侧只能是协程、Task 或 Future。
- **Task**：协程的可调度封装，`asyncio.create_task()` 创建，交给事件循环并发执行。
- **Future**：更底层的“未来结果”，Task 继承自 Future；日常业务里很少手动创建。

一个最小的并发例子：

```python
import asyncio

async def fetch(name: str, delay: float) -> str:
    print("start", name)
    await asyncio.sleep(delay)
    print("done", name)
    return name

async def main():
    tasks = [
        asyncio.create_task(fetch("a", 2)),
        asyncio.create_task(fetch("b", 2)),
        asyncio.create_task(fetch("c", 2)),
    ]
    result = await asyncio.gather(*tasks)
    print(result)

asyncio.run(main())
```

`asyncio.run()` 负责创建、运行、关闭事件循环；`create_task()` 才让协程真正进入调度；`gather()` 等待一组任务并收集结果。

### `async/await` 的几条硬规则

1. `await` 只能写在 `async def` 函数里。
2. 协程对象不 `await` 就不会执行。
3. `await` 右侧必须是可等待对象，`await 123` 会直接报错。
4. 协程里调用另一个协程，也要 `await`。
5. 在协程里调用同步阻塞函数（`time.sleep`、`requests.get`、同步数据库驱动），整个事件循环会被卡住，其他协程都动不了。

### `gather`、`wait` 和超时

`asyncio.gather()` 适合“批量执行、等全部完成”。传入协程时它会自动包装成 Task，返回顺序和传入顺序一致；`return_exceptions=True` 时，单个任务异常会作为结果返回，不会打断其他任务。

`asyncio.wait()` 更灵活，可以设置 `timeout` 和 `return_when`：

```python
done, pending = await asyncio.wait(
    tasks,
    timeout=2,
    return_when=asyncio.FIRST_COMPLETED,
)
for task in pending:
    task.cancel()
```

`wait_for()` 给单个任务加超时，超时会取消任务并抛 `TimeoutError`。如果不想让内层任务被取消，用 `asyncio.shield()` 包一层；外层仍然会超时，但内层可以继续跑。

### 异步迭代器、生成器和上下文管理器

普通 `for` 对应 `__iter__` / `__next__`；异步迭代对应 `__aiter__` / `__anext__`，用 `async for` 消费。手写异步迭代器比较啰嗦，通常直接用异步生成器：

```python
async def gen(n):
    for i in range(n):
        await asyncio.sleep(0.1)
        yield i

async def main():
    async for value in gen(3):
        print(value)
```

异步上下文管理器实现 `__aenter__` / `__aexit__`，用 `async with` 管理连接、锁、会话这类需要异步释放的资源。`__aexit__` 返回 `True` 会吞掉异常，返回 `False` 会继续抛出。

### 并发控制：Lock、Semaphore、Event、Queue

- `asyncio.Lock`：保护共享资源，避免多个协程同时修改。
- `asyncio.Semaphore`：限制同时执行的协程数，比如 HTTP 并发控制在 50。
- `asyncio.Event`：一个协程通知其他协程“可以继续了”。
- `asyncio.Queue`：生产者-消费者模型，`put()` / `get()` 在满/空时自动挂起。

```python
sem = asyncio.Semaphore(3)

async def worker(i):
    async with sem:
        await asyncio.sleep(1)
        print(i)

await asyncio.gather(*(worker(i) for i in range(10)))
```

这些同步原语都是协程级的，不要拿 `threading.Lock` 直接在协程里当异步锁用。

### 和第三方库结合

同步 HTTP 用 `requests`，异步 HTTP 用 `aiohttp` 或 `httpx.AsyncClient`；同步 MySQL 用 `pymysql`，异步用 `aiomysql`；PostgreSQL 常用 `asyncpg`。连接池要复用，不要每个请求新建。

如果某个库只有同步实现，用 `loop.run_in_executor()` 把它丢到线程池，避免阻塞事件循环：

```python
loop = asyncio.get_running_loop()
result = await loop.run_in_executor(None, blocking_func)
```

CPU 密集型任务不要指望 asyncio 加速，协程仍然跑在一个线程里；用 `multiprocessing` 或进程池，再和 asyncio 组合。

### 常见坑

- 忘记 `await`，拿到的是协程对象，不是结果。
- 在协程里调同步阻塞函数，事件循环被卡死。
- 创建了 Task 却不 `await` 或 `cancel()`，程序退出时任务被强制终止。
- 连接池、文件、锁没有正确释放。
- 用 `queue.join()` 却漏了 `task_done()`，会永久阻塞。
- 把所有东西都异步化；只有一两次 IO 的简单逻辑，同步代码更清楚。

## FastAPI：把异步落到一次请求上

FastAPI 可以看成 Starlette + Pydantic 的组合：Starlette 提供 ASGI、路由、请求响应、WebSocket 这些 Web 能力，Pydantic 负责类型校验、序列化和配置。FastAPI 在两者之上加了依赖注入、自动生成 OpenAPI 文档和基于类型提示的参数解析。

和 Flask、Django 比：

- Flask 是微框架，路由、模板、扩展自己选，适合小中型服务和需要自由拼装的场景。
- Django 是全家桶，ORM、Admin、认证、表单都内置，适合业务完整、需要快速搭后台的项目。
- FastAPI 更偏 API 服务，异步优先、类型驱动、文档自动生成，适合前后端分离和高并发 IO 场景。它不是“更快的 Flask”，而是另一套 ASGI 生态。

RESTful API 的基本原则不复杂：用 HTTP 方法表达操作（GET/POST/PUT/DELETE），每个资源有唯一 URI，请求无状态，响应可缓存，接口统一。真正难的是资源怎么划分、状态码怎么用、分页和错误格式怎么统一。

### 依赖注入和 Pydantic

FastAPI 的 `Depends` 用起来像参数默认值，但背后是一套依赖图：

```python
from fastapi import Depends, FastAPI, HTTPException

app = FastAPI()

async def get_db():
    async with SessionLocal() as session:
        yield session

async def get_current_user(token: str = Depends(oauth2_scheme)):
    user = await decode_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="invalid token")
    return user

@app.get("/me")
async def me(user=Depends(get_current_user), db=Depends(get_db)):
    return await load_profile(db, user.id)
```

依赖可以是同步或异步的，也可以有子依赖。同一个请求里，同一个依赖默认只执行一次，结果会被缓存；需要每次都重新执行时传 `use_cache=False`。数据库会话、当前用户、分页参数都适合做成依赖。

Pydantic 负责请求体和响应体的校验/序列化。`BaseModel` 加类型注解就能做类型转换、嵌套模型、字段校验；`response_model` 可以过滤掉不该返回的字段；`pydantic-settings` 适合管理环境变量和配置。

### `def` 和 `async def` 的区别

这是 FastAPI 里最容易踩的坑。

- `def` 路由函数会被 FastAPI 放到线程池执行，不会阻塞事件循环，但线程池有上限。
- `async def` 路由函数直接在事件循环里执行，里面任何同步阻塞调用都会卡住整个 worker。

所以 `async def` 里不要直接调 `requests.get()`、`time.sleep()`、同步 SQLAlchemy Session 或 `pymysql`。要么换成异步驱动（`httpx.AsyncClient`、`asyncpg`、SQLAlchemy async、`aiomysql`），要么用 `run_in_executor` 丢到线程池。

同步数据库在 async 路由里是最常见的故障：本地一两个请求看不出来，一上并发所有请求都变慢，因为事件循环被一个查询堵住了。

### 认证、数据库和后台任务

- 认证常见做法是 OAuth2 Password + JWT：`OAuth2PasswordBearer` 取 token，依赖里解码、校验、查用户；密码用 `passlib` 的 bcrypt/argon2 哈希，绝不存明文。
- 异步数据库要选异步驱动，连接池要复用；SQLAlchemy 2.0 的 async session、`asyncpg`、`aiomysql` 都可以。不要在异步会话里混用同步 API。
- `BackgroundTasks` 适合发通知、写日志、轻量清理这类“响应后顺便做”的任务。它在同一个进程里执行，不适合长任务、重任务；真要跑几分钟，交给 Celery、RQ、Arq 这类队列。
- 文件上传用 `UploadFile` / `File`，大文件边读边写，别一次性 `read()` 到内存。
- WebSocket 用 `@app.websocket("/ws")`，在函数里 `receive_text()` / `send_text()` 循环处理。
- 限流可以用 `slowapi` 或自己写中间件；单机内存计数简单，多实例要放 Redis。
- 部署通常是 Uvicorn 起 ASGI，前面挂 Nginx/Traefik，Docker 打包；多 worker 可以用 `uvicorn --workers` 或 Gunicorn 的 UvicornWorker。

### FastAPI 常见问题速答

| 问题 | 一句话回答 |
| --- | --- |
| RESTful API 原则 | HTTP 方法表达操作、资源唯一 URI、无状态、可缓存、统一接口 |
| FastAPI 和 Starlette/Pydantic 的关系 | Starlette 提供 Web 层，Pydantic 提供校验和序列化，FastAPI 在其上做依赖注入和文档 |
| 如何做依赖注入 | `Depends` 声明依赖，支持子依赖、同步/异步、请求内缓存 |
| 如何做数据校验 | Pydantic `BaseModel` + 类型注解，配合 `response_model` 控制输出 |
| 如何做认证授权 | OAuth2 + JWT / opaque token，依赖里校验用户和权限 |
| 如何异步访问数据库 | 异步驱动 + 连接池 + `async def` 里 `await`，不要混同步 Session |
| 后台任务怎么工作 | 响应返回后在同进程执行，适合轻量任务；重任务用队列 |
| 文件上传怎么处理 | `UploadFile` / `File`，流式读写，限制大小和类型 |
| WebSocket 怎么用 | `@app.websocket` + `receive_text` / `send_text` |
| 限流怎么做 | 中间件或 `slowapi`；多实例用 Redis 共享计数 |
| 怎么部署 | Uvicorn/Gunicorn + Nginx/Traefik + Docker，多 worker |
| CORS 怎么配 | `CORSMiddleware`，限制 allow_origins / methods / headers |
| 异常怎么处理 | `HTTPException` + `@app.exception_handler`，统一错误结构 |
| 依赖缓存是什么 | 同一请求内同一依赖只执行一次，`use_cache=False` 可关闭 |
| API 版本控制 | 路径前缀 `/v1`、独立 Router 或子应用 |
| 支持 GraphQL 吗 | 可以，Strawberry / Graphene 挂到 `/graphql` |
| 国际化和模板 | Babel 等库做 i18n；Jinja2 做模板渲染 |
| 密码怎么存 | bcrypt / argon2 哈希 + salt，绝不存明文 |
| 环境变量怎么管 | `pydantic-settings` / `python-dotenv`，敏感信息不进代码 |
| 响应时间怎么优化 | 异步 IO、索引和查询优化、连接池、缓存、orjson、分页、监控 |

## 把三块串起来：一次请求的生命周期

一个 FastAPI 请求大概是这样走的：

```text
客户端
  → Uvicorn（ASGI server）
  → Starlette 路由
  → 依赖注入（认证、数据库 session、分页参数）
  → async 路由函数
  → await 数据库 / HTTP / 缓存
  → Pydantic 序列化
  → 响应返回
  → BackgroundTasks（响应后执行）
```

异步真正发挥作用的地方，是“等待 IO 的时候让出事件循环”。数据库查询、HTTP 调用、Redis、文件读写，这些等待时间越长，异步的收益越明显。

它不能解决的是 CPU 密集计算。图片处理、加密、复杂计算放到 `async def` 里，照样会把事件循环卡住；应该丢进程池，或者拆到独立服务。

面试里如果被问“FastAPI 为什么快”，不要只说“用了 async”。更完整的回答是：ASGI + 事件循环让 IO 等待可以重叠，Pydantic 用 Rust 核心做校验，依赖注入和类型提示减少了手写解析，但前提是路由里没有同步阻塞调用。

## 最后一页速记

- 可变对象不能做 dict key；默认参数不要用 `[]` / `{}`。
- 浅拷贝共享子对象，深拷贝递归复制；`is` 比身份，`==` 比值。
- `yield` 是惰性生成器；`return` 一次性返回并结束函数。
- LEGB：Local → Enclosing → Global → Built-in；改外层变量用 `global` / `nonlocal`。
- `__new__` 创建对象，`__init__` 初始化；MRO 解决多继承，鸭子类型实现多态。
- asyncio 适合 IO 密集型；协程遇到 `await` 让出，事件循环负责调度。
- `gather` 等全部，`wait` 可控等待，`wait_for` 超时，`shield` 保护内层任务。
- `Semaphore` 控并发，`Lock` 保护共享资源，`Queue` 做生产者-消费者。
- 协程里不要调同步阻塞函数；必须调用就 `run_in_executor`。
- FastAPI = Starlette + Pydantic；`def` 走线程池，`async def` 走事件循环。
- 同步数据库不要放进 `async def`；用异步驱动或线程池。
- `BackgroundTasks` 不是任务队列；长任务交给 Celery / RQ / Arq。
- 依赖默认请求内缓存；`response_model` 控制输出；`HTTPException` 统一错误。
- 部署用 Uvicorn/Gunicorn + Nginx，前面可以加 Docker 和健康检查。

## 参考

- asyncio 进阶语法原文：<https://xianzs.github.io/#/notes/Python_Learn/Python_Advance_Learn/%E8%A1%A5%E5%85%851%EF%BC%9APython%20asyncio%20%E8%BF%9B%E9%98%B6%E8%AF%AD%E6%B3%95%E5%85%A8%E9%9D%A2%E8%A7%A3%E6%9E%90>
- Python/FastAPI 部分整理自一份面试笔记，结合本文的异步部分做了重新组织。


