---
title: "[Kotlin-1] 기초1"
date: 2026-05-12
categories: ["Kotlin"]
slug: "kotlin-1-기초1"
draft: false
---


## 변수


모든 프로그램은 변수를 통해 데이터를 저장할 수 있다. 코틀린에서는 다음과 같이 선언할 수 있다:

- read-only 변수: `val`
- 변경 가능한 변수: `var`

```kotlin
val popcorn = 5    // There are 5 boxes of popcorn
val hotdog = 7     // There are 7 hotdogs
var customers = 10 // There are 10 customers in the queue

// Some customers leave the queue
customers = 8
println(customers)
// 8
```


코틀린은 타입 추론이 가능하기 때문에 `val a = 3` 으로 선언할 경우 `a` 의 타입이 `Int` 라고 추론한다.


하지만, `val a` 만 선언은 불가능하고, `val a: Int` 타입만 지정하는 것은 가능하다.  
이후에 `a = 10` 등, 단 한 번만 선언이 가능하게 된다.


`val a: Int` 로 선언했다면 다른 곳에서 사용하기 전에 무조건 **초기화**를 시켜야 한다


| **Category**           | **Basic types**                    | **Example code**                                              |
| ---------------------- | ---------------------------------- | ------------------------------------------------------------- |
| Integers               | `Byte`, `Short`, `Int`, `Long`     | `val year: Int = 2020`                                        |
| Unsigned integers      | `UByte`, `UShort`, `UInt`, `ULong` | `val score: UInt = 100u`                                      |
| Floating-point numbers | `Float`, `Double`                  | `val currentTemp: Float = 24.5f`, `val price: Double = 19.99` |
| Booleans               | `Boolean`                          | `val isEnabled: Boolean = true`                               |
| Characters             | `Char`                             | `val separator: Char = ','`                                   |
| Strings                | `String`                           | `val message: String = "Hello, world!"`                       |


## String


문자열은 `"` 를 통해 나타낼 수 있고, `$` + 변수 조합을 통해 문자열 내에서 그 변수의 값을 나타낼 수 있다.


```kotlin
val customers = 10
println("There are $customers customers")
// There are 10 customers

println("There are ${customers + 1} customers")
// There are 11 customers
```


## Collections


여러 데이터를 다루는데 collection을 사용할 수 있다.


| **Collection type** | **Description**                                                         |
| ------------------- | ----------------------------------------------------------------------- |
| Lists               | Ordered collections of items                                            |
| Sets                | Unique unordered collections of items                                   |
| Maps                | Sets of key-value pairs where keys are unique and map to only one value |


### List


순서가 있고, 중복 항목을 허용한다.

- 생성

    ```kotlin  
    // 읽기 전용  
    val readOnlyShapes = listOf("triangle", "square", "circle")
    
    // 변경 가능 (타입 명시)  
    val shapes: MutableList<String> = mutableListOf("triangle", "square", "circle")
    
    // 읽기 전용 뷰  
    val shapesLocked: List<String> = shapes  
    ```

- 주요 사용법

    ```kotlin  
    val readOnlyShapes = listOf("triangle", "square", "circle")
    
    // 인덱스 접근  
    println(readOnlyShapes[0])          // triangle
    
    // 첫 번째 / 마지막 요소  
    println(readOnlyShapes.first())     // triangle  
    println(readOnlyShapes.last())      // circle
    
    // 개수  
    println(readOnlyShapes.count())     // 3
    
    // 포함 여부  
    println("circle" in readOnlyShapes) // true  
    ```

- 변경

    ```kotlin  
    shapes.add("pentagon")     // 추가  
    shapes.remove("pentagon")  // 삭제  
    ```


### Set


순서가 없고, 중복을 허용하지 않는다.

- 생성

    ```kotlin  
    // 읽기 전용  
    val readOnlyFruit = setOf("apple", "banana", "cherry", "cherry")  
    // → 중복 제거되어 [apple, banana, cherry] 저장됨
    
    // 변경 가능 (타입 명시)  
    val fruit: MutableSet<String> = mutableSetOf("apple", "banana", "cherry")
    
    // 읽기 전용 뷰  
    val fruitLocked: Set<String> = fruit  
    ```

- 주요 사용법

    ```kotlin  
    val readOnlyFruit = setOf("apple", "banana", "cherry")
    
    // 개수  
    println(readOnlyFruit.count())      // 3
    
    // 포함 여부  
    println("banana" in readOnlyFruit)  // true  
    ```


### Map


key-value 로 데이터를 저장한다. key는 고유해야 하며, value는 중복 가능하다.

- 생성

    ```kotlin  
    // 읽기 전용  
    val readOnlyJuiceMenu = mapOf("apple" to 100, "kiwi" to 190, "orange" to 100)
    
    // 변경 가능 (타입 명시)  
    val juiceMenu: MutableMap<String, Int> = mutableMapOf("apple" to 100, "kiwi" to 190, "orange" to 100)
    
    // 읽기 전용 뷰  
    val juiceMenuLocked: Map<String, Int> = juiceMenu  
    ```

- 주요 사용법

    ```kotlin  
    val readOnlyJuiceMenu = mapOf("apple" to 100, "kiwi" to 190, "orange" to 100)
    
    // 값 접근 (키로 조회, 없으면 null 반환)  
    println(readOnlyJuiceMenu["apple"])      // 100  
    println(readOnlyJuiceMenu["pineapple"]) // null
    
    // 개수  
    println(readOnlyJuiceMenu.count())       // 3
    
    // 키 존재 여부  
    println(readOnlyJuiceMenu.containsKey("kiwi"))  // true
    
    // 키/값 목록  
    println(readOnlyJuiceMenu.keys)    // [apple, kiwi, orange]  
    println(readOnlyJuiceMenu.values)  // [100, 190, 100]
    
    // in 연산자로 확인  
    println("orange" in readOnlyJuiceMenu)          // true  
    println(200 in readOnlyJuiceMenu.values)        // false  
    ```

- 변경

    ```kotlin  
    juiceMenu["coconut"] = 150      // 추가  
    juiceMenu.remove("orange")      // 삭제  
    ```


## 조건문


### if


```kotlin
val d: Int
val check = true

if (check) {
    d = 1
} else {
    d = 2
}
println(d) // 1
```


Kotlin에는 삼항 연산자(`? :`)가 없는 대신, `if`를 **표현식**으로 쓸 수 있다.


```kotlin
val a = 1
val b = 2
println(if (a > b) a else b) // 2
```


### when


`if`보다 `when` 사용을 권장한다. 이유는 가독성이 좋고, 분기 추가가 쉽고, 실수가 줄기 때문이다.


**statement로 사용 (반환값 없음)**


```kotlin
val obj = "Hello"

when (obj) {
    "1"     -> println("One")
    "Hello" -> println("Greeting")
    else    -> println("Unknown")
}
// Greeting
```


**expression으로 사용 (반환값 있음)**


```kotlin
val result = when (obj) {
    "1"     -> "One"
    "Hello" -> "Greeting"
    else    -> "Unknown"
}
println(result) // Greeting
```


**subject 없이 사용 (Boolean 체인)**


```kotlin
val trafficAction = when {
    trafficLightState == "Green"  -> "Go"
    trafficLightState == "Yellow" -> "Slow down"
    trafficLightState == "Red"    -> "Stop"
    else -> "Malfunction"
}
```

> subject를 명시하면 더 간결하고, Kotlin이 모든 케이스를 커버했는지 검사해준다.

```kotlin
val trafficAction = when (trafficLightState) {
    "Green"  -> "Go"
    "Yellow" -> "Slow down"
    "Red"    -> "Stop"
    else     -> "Malfunction"
}
```


## 반복문


Range: 반복문에서 자주 쓰이는 범위 표현 방식이다.


| 표현            | 의미                          |
| ------------- | --------------------------- |
| `1..4`        | 1, 2, 3, 4 (끝 포함)           |
| `1..<4`       | 1, 2, 3 (끝 미포함)             |
| `4 downTo 1`  | 4, 3, 2, 1 (역순)             |
| `1..5 step 2` | 1, 3, 5 (증가 단위 지정)          |
| `'a'..'d'`    | 'a', 'b', 'c', 'd' (문자도 가능) |


### for


```kotlin
for (number in 1..5) {
    print(number)
}
// 12345
```


컬렉션도 순회 가능하다.


```kotlin
val cakes = listOf("carrot", "cheese", "chocolate")

for (cake in cakes) {
    println("Yummy, it's a $cake cake!")
}
```


### while


조건이 true인 동안 반복한다.


```kotlin
var cakesEaten = 0
while (cakesEaten < 3) {
    println("Eat a cake")
    cakesEaten++
}
```


### do-while


코드 블록을 **먼저 실행**한 후 조건을 검사한다. 최소 한 번은 실행된다.


```kotlin
do {
    println("Bake a cake")
    cakesBaked++
} while (cakesBaked < cakesEaten)
```

