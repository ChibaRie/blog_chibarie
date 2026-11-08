---
title: "Python 基础串讲：解释器、语法糖与装饰器"
slug: "python-basics-interpreter-syntax-sugar-decorators"
date: "2026-11-08T18:00:00+08:00"
summary: "从 CPython 如何运行代码出发，串起变量与对象、切片、推导式、解包、迭代器、闭包和装饰器，用可运行的例子理解简洁写法背后的执行过程。"
cover: "/uploads/2026/11/20261108-python-basics-cover.jpg"
category: "tech"
tags: ["Python", "编程基础", "装饰器", "学习笔记"]
isTop: false
draft: false
---

读 Python 代码时，经常会遇到一些很短的写法。`a, b = b, a` 交换变量，列表推导式把循环放进方括号，函数上面加一个 `@timer` 就能统计耗时。把这些写法拆开后，会发现它们和对象、函数、作用域之间有一条清晰的联系。

这篇从“代码怎样运行”开始，逐步走到“函数怎样包装函数”。适合已经接触过变量、分支和循环，想把几个零散概念连起来的读者。示例按 Python 3 编写，执行机制以 CPython 为范围，并在本地 Python 3.13.9 上验证。

选题参考了雪梨代码库的装饰器、切片和字符串格式化文章，本文重新安排了结构并编写示例，相关资料见文末。

## 一、解释器怎样运行一段 Python 代码

### Python、CPython 与编辑器

Python 语言规定语法和程序行为，CPython 是实现这套语言的一种解释器。编辑器负责帮助我们编写代码，执行 `python demo.py` 时，实际工作的程序由终端环境中的 `python` 命令决定。

可以先在终端确认当前环境。

```bash
python --version
python -c "import sys; print(sys.executable)"
python -c "import platform; print(platform.python_implementation())"
```

第一条查看版本，第二条查看解释器路径，第三条查看实现名称。电脑上存在多个虚拟环境时，这几条命令能帮助确认当前运行代码的环境。[Python 官方术语表](https://docs.python.org/3.13/glossary.html#term-CPython)

### 从源码到执行

在 CPython 中，可以先用下面这条简化流程建立印象。

```text
Python 源码
    ↓ 解析与编译
代码对象，其中包含字节码
    ↓ 解释器执行字节码
程序产生结果
```

这里同时包含编译和解释执行两个阶段。`compile()` 可以把源码编译成代码对象，`exec()` 可以执行这个对象。将下面的代码保存为脚本运行，就能观察这个过程。

```python
source = "total = 6 * 7\nprint(total)"
code = compile(source, "<example>", "exec")
namespace = {}

exec(code, namespace)
print(namespace["total"])
# 42
# 42
```

想进一步看指令，可以调用 `dis.dis(code)`。字节码属于 CPython 的实现细节，指令形式会随版本变化，入门时了解执行层次即可。[dis 官方文档](https://docs.python.org/3.13/library/dis.html)

### `__pycache__` 里存了什么

导入模块时，CPython 通常会将编译后的代码缓存为 `__pycache__` 中的 `.pyc` 文件。后续导入时，满足有效性检查的缓存可以节省重新编译的工作。

`.pyc` 的主要收益在模块加载阶段。程序执行同一段逻辑时，仍然需要运行其中的代码。直接通过命令行运行的主脚本通常也不会生成自己的 `.pyc` 缓存。[Python 模块教程](https://docs.python.org/3.13/tutorial/modules.html#compiled-python-files)

## 二、先理解变量与对象

Python 中的赋值会建立名称与对象之间的绑定关系。理解这一点，后面的解包、闭包和装饰器就容易连起来。

```python
original = ["Python"]
alias = original
alias.append("SQL")

print(original)          # ['Python', 'SQL']
print(alias is original) # True
print(alias == original) # True
```

两个名称指向同一个列表，因此通过任意一个名称修改列表，都能从另一个名称观察到变化。`is` 比较对象身份，`==` 比较相等关系。判断空值通常写 `value is None`。[Python 数据模型](https://docs.python.org/3.13/reference/datamodel.html#objects-values-and-types)

复制容器时，还要关注复制的深度。

```python
original = [[1], [2]]
copied = original[:]
copied[0].append(9)

print(copied is original)       # False
print(copied[0] is original[0]) # True
print(original)                 # [[1, 9], [2]]
```

列表切片创建了一个新列表，但内部元素依然引用原来的子列表，这叫浅拷贝。需要递归复制嵌套结构时，可以根据对象特点考虑 `copy.deepcopy()`。[copy 官方文档](https://docs.python.org/3.13/library/copy.html)

## 三、语法糖怎样让表达更简洁

“语法糖”通常指一种更便于书写和阅读的语法形式，它表达的操作可以用更基础的形式说明。理解这些写法时，可以先尝试展开，再检查求值顺序、作用域和对象行为。

下面一起整理几种常见的简洁写法，其中既有语法层面的便利，也有常用内置工具。它们的使用场景和运行规则各有侧重。

### 1. 解包与交换变量

```python
left, right = 3, 8
left, right = right, left
print(left, right)  # 8 3

first, *middle, last = [10, 20, 30, 40]
print(first)   # 10
print(middle)  # [20, 30]
print(last)    # 40
```

交换时先求右侧表达式的值，再进行左侧赋值。带星号的目标会把剩余元素收集到列表中，适合“首项、若干中间项、末项”这种结构。[赋值语句规则](https://docs.python.org/3.13/reference/simple_stmts.html#assignment-statements)

### 2. 切片

`sequence[start:stop:step]` 用起点、终点和步长描述要取出的部分。正向切片包含起点，终点作为排除边界。

```python
values = [0, 1, 2, 3, 4, 5]

print(values[1:4])    # [1, 2, 3]
print(values[::2])    # [0, 2, 4]
print(values[::-1])   # [5, 4, 3, 2, 1, 0]
print(values[4:1:-1]) # [4, 3, 2]
```

步长为负时，遍历方向反转。省略边界时，默认值会配合步长方向决定，所以理解 `[::-1]` 时应同时关注方向和边界。列表切片会生成新列表，复制大列表时也会产生相应的时间与空间开销。[内置序列类型](https://docs.python.org/3.13/library/stdtypes.html#common-sequence-operations)

### 3. 列表推导式

先写出一个普通循环，再把筛选和变换放进列表推导式里。

```python
numbers = range(6)

result = []
for number in numbers:
    if number % 2 == 0:
        result.append(number * number)

squares = [number * number for number in numbers if number % 2 == 0]
assert result == squares == [0, 4, 16]
```

阅读时可以按 `for`、`if`、最前面的表达式来理解，也就是先遍历、再筛选、再计算结果。这个展开有助于理解逻辑，实际使用中还要记住 Python 3 的推导式拥有独立的迭代变量作用域。分支和嵌套层数增多时，展开成普通循环更方便逐步调试。[数据结构教程](https://docs.python.org/3.13/tutorial/datastructures.html#list-comprehensions)

### 4. 条件表达式与 f-string

```python
score = 82
label = "pass" if score >= 60 else "retry"
print(label)  # pass

cost = 1234.5
print(f"Cost: {cost:,.2f}") # Cost: 1,234.50
print(f"{score=}")        # score=82
```

条件表达式会根据条件选择并计算其中一个分支。f-string 则在运行到该表达式时计算花括号中的内容，格式说明符控制显示形式。这里的 `,.2f` 表示千位分组并保留两位小数。[条件表达式](https://docs.python.org/3.13/reference/expressions.html#conditional-expressions)、[格式化字符串字面值](https://docs.python.org/3.13/reference/lexical_analysis.html#f-strings)

### 5. `enumerate()` 与 `zip()`

```python
names = ["Ada", "Lin"]
scores = [95, 88]

for index, name in enumerate(names, start=1):
    print(index, name)
# 1 Ada
# 2 Lin

for name, score in zip(names, scores):
    print(name, score)
# Ada 95
# Lin 88
```

`enumerate()` 提供计数值和元素，`zip()` 将多个可迭代对象中的元素配对。默认情况下，`zip()` 在最短的输入耗尽时结束。业务要求长度严格一致时，可在 Python 3.10 及以上使用 `zip(..., strict=True)`，迭代过程中发现长度不一致会抛出 `ValueError`。[内置函数文档](https://docs.python.org/3.13/library/functions.html#zip)

## 四、迭代器与生成器

可迭代对象可以交给 `iter()` 获取迭代器，迭代器用 `next()` 提供后续元素，耗尽时抛出 `StopIteration`。`for` 循环会替我们处理这套取值过程。[Python 官方术语表](https://docs.python.org/3.13/glossary.html#term-iterator)

```python
iterator = iter([10, 20])
print(next(iterator)) # 10
print(next(iterator)) # 20

try:
    next(iterator)
except StopIteration:
    print("finished")
# finished
```

函数体中出现 `yield`，调用这个函数会得到生成器。推进生成器时，它运行到 `yield` 暂停并交出一个值，下一次推进时从暂停处继续。

```python
def countdown(start):
    while start > 0:
        yield start
        start -= 1

remaining = countdown(3)
print(next(remaining)) # 3
print(list(remaining)) # [2, 1]
print(list(remaining)) # []
```

生成器保存执行状态，已经消费的元素会随着迭代向前推进。需要重新从头遍历时，可以重新调用生成器函数创建一个新对象。

生成器表达式也遵循惰性迭代的思路。

```python
numbers = (number * number for number in range(4))
print(sum(numbers))  # 14
print(list(numbers)) # []
```

这里在消费时逐个生成平方值，适合将结果继续交给 `sum()` 或后续迭代步骤。生成器减少了保存全部结果的需要，整体内存占用仍取决于输入和后续处理方式。[生成器与生成器表达式教程](https://docs.python.org/3.13/tutorial/classes.html#generators)

## 五、函数、参数与闭包

### 函数可以作为值传递

```python
def double(number):
    return number * 2

def transform(value, operation):
    return operation(value)

action = double
print(action(4))            # 8
print(transform(5, double)) # 10
```

`double` 表示函数对象，`double(4)` 表示调用后的结果。把函数赋给变量、作为参数传入其他函数、作为结果返回，这些能力共同构成了理解装饰器的基础。[Python 数据模型中的用户定义函数](https://docs.python.org/3.13/reference/datamodel.html#user-defined-functions)

### `*args` 与 `**kwargs`

函数定义中的 `*args` 收集额外的位置参数，`**kwargs` 收集额外的关键字参数。调用时，同样的符号负责展开可迭代对象和映射。

```python
def describe(*args, **kwargs):
    return args, kwargs

print(describe(1, 2, language="Python"))
# ((1, 2), {'language': 'Python'})

positional = (1, 2)
named = {"language": "Python"}
assert describe(*positional, **named) == describe(1, 2, language="Python")
```

`args` 和 `kwargs` 是约定俗成的名称，收集与展开的行为由星号决定。装饰器中的包装函数经常借助这两个参数，把收到的调用继续传给原函数。[函数定义与参数教程](https://docs.python.org/3.13/tutorial/controlflow.html#arbitrary-argument-lists)

### 闭包怎样保留外层状态

```python
def make_multiplier(factor):
    def multiply(number):
        return number * factor
    return multiply

triple = make_multiplier(3)
print(triple(7)) # 21
```

外层函数已经返回，内层函数仍可以访问它引用的外层变量 `factor`，这样的函数与其关联环境构成闭包。

普通嵌套函数的名称查找，可以先用 LEGB 理解，也就是局部作用域、外层函数作用域、模块全局作用域、内置作用域。要在内层重新绑定外层函数中的变量，可以使用 `nonlocal`。[作用域与命名空间](https://docs.python.org/3.13/tutorial/classes.html#python-scopes-and-namespaces)

```python
def make_counter():
    count = 0

    def increment():
        nonlocal count
        count += 1
        return count

    return increment

counter = make_counter()
print(counter()) # 1
print(counter()) # 2
```

闭包捕获的变量在调用时取值。循环中创建多个闭包时，这个行为尤其值得留意。

```python
def make_readers():
    readers = []
    for value in range(3):
        def read():
            return value
        readers.append(read)
    return readers

print([read() for read in make_readers()]) # [2, 2, 2]
```

三个函数引用了同一个外层变量，调用时循环已结束，变量的值是 `2`。需要保留每次循环的当前值时，可以使用在定义时求值的默认参数。

```python
readers = [lambda value=value: value for value in range(3)]
print([read() for read in readers]) # [0, 1, 2]
```

这里右侧的 `value` 在创建函数时求值，左侧的 `value` 是该函数的形参。后续调用使用保存下来的默认值。[Python 编程常见问题](https://docs.python.org/3.13/faq/programming.html#why-do-lambdas-defined-in-a-loop-with-different-values-all-return-the-same-result)

## 六、装饰器怎样包装函数

### 从手动包装开始

常见的函数装饰器接收一个函数，返回一个可调用对象。调用返回的对象时，就有机会在原函数前后加入逻辑。

```python
def announce(function):
    def wrapped(*args, **kwargs):
        print("begin")
        result = function(*args, **kwargs)
        print("end")
        return result
    return wrapped

def multiply(left, right):
    return left * right

multiply = announce(multiply)
print(multiply(6, right=7))
# begin
# end
# 42
```

执行赋值后，名称 `multiply` 绑定到 `wrapped`。这个包装函数通过闭包保留原来的 `function`，收到调用后继续执行它。

注意两个返回值。外层的 `return wrapped` 把包装函数交出去，内层的 `return result` 把业务函数的结果交回调用者。

### `@` 的展开与执行时机

在上一个例子中，手动赋值可以用装饰器语法表达。下面展示它的写法，`announce` 沿用上面的定义。

```python
@announce
def multiply(left, right):
    return left * right
```

它的核心效果可以展开为 `multiply = announce(multiply)`。执行到函数定义时，会创建原函数并应用装饰器。之后每次调用 `multiply(...)`，才进入返回的包装函数。这也解释了为什么导入模块时，就可能看到装饰器外层代码产生的日志。[函数定义中的装饰器规则](https://docs.python.org/3.13/reference/compound_stmts.html#function-definitions)

### 一个完整的同步计时装饰器

```python
from functools import wraps
from time import perf_counter

def timed(function):
    @wraps(function)
    def wrapped(*args, **kwargs):
        started = perf_counter()
        try:
            return function(*args, **kwargs)
        finally:
            elapsed = perf_counter() - started
            print(f"{function.__name__}: {elapsed:.6f}s")
    return wrapped

@timed
def sum_squares(limit):
    """Calculate the sum of squares below limit."""
    return sum(number * number for number in range(limit))

assert sum_squares(4) == 14
print(sum_squares.__name__) # sum_squares
```

`perf_counter()` 适合测量经过的时间。`finally` 使成功和异常路径都会记录耗时，原函数抛出的异常会继续向调用者传播。[时间函数文档](https://docs.python.org/3.13/library/time.html#time.perf_counter)、[finally 的执行规则](https://docs.python.org/3.13/reference/compound_stmts.html#finally-clause)

`wraps(function)` 会更新包装函数的名称、文档等元数据，并设置 `__wrapped__` 指向原函数，方便检查工具沿包装链查找。这些信息有助于调试和生成文档。参数转发与返回值转发仍由包装函数中的代码完成。[functools.wraps 文档](https://docs.python.org/3.13/library/functools.html#functools.wraps)

这个例子面向普通同步函数。包装 `async def` 时，需要使用异步包装函数，在内部 `await` 原协程才能覆盖协程执行的耗时。生成器的计时范围也需要根据创建与迭代过程另行设计。

### 带参数的装饰器

需要为装饰器指定日志前缀时，可以先接收配置，再返回真正的装饰器。

```python
from functools import wraps

def tagged(label):
    def decorate(function):
        @wraps(function)
        def wrapped(*args, **kwargs):
            print(f"[{label}] {function.__name__}")
            return function(*args, **kwargs)
        return wrapped
    return decorate

@tagged("math")
def subtract(left, right):
    return left - right

print(subtract(9, 4))
# [math] subtract
# 5
```

三层函数分别负责接收配置、接收原函数、接收调用参数。`@tagged("math")` 的核心效果可以展开为 `subtract = tagged("math")(subtract)`，顺着每一层的返回值就能读懂它。[函数定义中的装饰器规则](https://docs.python.org/3.13/reference/compound_stmts.html#function-definitions)

### 多个装饰器的叠加顺序

```python
from functools import wraps

def trace(label):
    def decorate(function):
        @wraps(function)
        def wrapped(*args, **kwargs):
            print(f"{label} enter")
            result = function(*args, **kwargs)
            print(f"{label} leave")
            return result
        return wrapped
    return decorate

@trace("outer")
@trace("inner")
def work():
    print("work")

work()
# outer enter
# inner enter
# work
# inner leave
# outer leave
```

这一组合的核心绑定关系是 `work = trace("outer")(trace("inner")(work))`。装饰器表达式按书写顺序求值，得到的装饰器从靠近函数的一层开始应用。调用时先进入最外层包装，再逐层进入内部。

日志、权限检查、事务管理等逻辑叠加时，顺序会影响可观察到的行为，可以像上面一样先打印进入和离开的顺序，再确定组合方式。[装饰器的应用规则](https://docs.python.org/3.13/reference/compound_stmts.html#function-definitions)

## 七、`with` 怎样管理资源

`with` 也是一种围绕代码块组织通用行为的语法。进入时调用上下文管理器的 `__enter__()`，正常退出或发生异常时调用 `__exit__()`。文件对象借助这个协议在退出代码块时关闭文件。[上下文管理器协议](https://docs.python.org/3.13/reference/datamodel.html#with-statement-context-managers)

下面用标准库创建临时目录，观察文件在代码块结束后的状态。示例结束时临时文件会随目录一起清理。

```python
from pathlib import Path
from tempfile import TemporaryDirectory

with TemporaryDirectory() as directory:
    path = Path(directory) / "note.txt"

    with path.open("w", encoding="utf-8") as stream:
        stream.write("hello\n")

    print(stream.closed) # True
    print(path.read_text(encoding="utf-8").strip()) # hello
```

理解 `with` 时，可以将它联系到“建立环境、执行代码块、退出清理”这三个阶段。自定义上下文管理器还可以通过 `__exit__()` 的返回值控制异常传播，因此完整行为取决于所用对象。[with 语句规则](https://docs.python.org/3.13/reference/compound_stmts.html#the-with-statement)

## 八、两个容易带进项目的基础问题

### 可变默认参数会跨调用保留

函数默认参数在执行函数定义时求值。如果将列表作为默认值，多次省略该参数的调用就会复用它。

```python
def remember(value, records=[]):
    records.append(value)
    return records

print(remember("a")) # ['a']
print(remember("b")) # ['a', 'b']
```

希望每次省略参数都创建新列表时，可以用 `None` 作为默认值，在函数体中创建列表。

```python
def remember(value, records=None):
    if records is None:
        records = []
    records.append(value)
    return records

print(remember("a")) # ['a']
print(remember("b")) # ['b']
```

这和闭包例子使用默认参数保存当前值，依赖的是同一个“定义时求值”规则。理解规则后，再根据是否需要共享对象来选择写法。[默认参数教程](https://docs.python.org/3.13/tutorial/controlflow.html#default-argument-values)

### 类型提示需要工具或额外逻辑配合

```python
def join_values(left: int, right: int) -> int:
    return left + right

print(join_values(2, 3))     # 5
print(join_values("a", "b")) # ab
```

类型检查工具会指出第二次调用与注解不符。普通 Python 运行时仍按实际对象支持的操作执行，这里两个字符串相加得到 `ab`。类型提示可服务于编辑器和静态检查，接口输入校验则需要显式校验代码或相应框架支持。[typing 官方文档](https://docs.python.org/3.13/library/typing.html)

## 九、把知识连起来

可以用四个问题检查自己是否理解了一段简洁写法。

1. 哪些名称绑定到了哪些对象，是否共享了可变状态。
2. 表达式在什么时候求值，发生在定义时、调用时还是迭代时。
3. 控制流怎样进入、暂停和退出，异常经过哪些路径。
4. 参数、返回值和函数元数据经过包装后怎样传递。

读到装饰器时，先展开 `@`，沿着函数的返回值逐层查找。读到推导式时，先恢复循环和筛选过程。读到生成器时，跟踪每一次推进和暂停。再回头看这些写法，简洁的语法就能和具体的执行过程对应起来。

## 参考与延伸阅读

参考站点提供了本文的入门选题线索，语言行为以各节链接的 Python 官方文档为依据。

- [雪梨代码库 · Python 装饰器入门](https://xn--ivr.net/index.php/post/72)
- [雪梨代码库 · Python 切片入门](https://xn--ivr.net/index.php/post/73)
- [雪梨代码库 · Python f-string 格式化字符串入门](https://xn--ivr.net/index.php/post/61)
- [Python 3.13 官方教程](https://docs.python.org/3.13/tutorial/)

继续阅读异步执行与接口开发，可以接着看本站的 [Python 基础、asyncio 与 FastAPI 学习笔记](/post/python-asyncio-fastapi-notes)。
