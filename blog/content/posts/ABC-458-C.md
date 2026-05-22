---
title: "[ABC 458-C] C Stands for Center"
date: 2026-05-22
tags: ["AtCoder", "ABC", "문자열"]
categories: ["PS"]
slug: "ABC-458-C"
math: true
draft: false
---


[https://atcoder.jp/contests/abc458/tasks/abc458_c](https://atcoder.jp/contests/abc458/tasks/abc458_c)


다음 조건을 만족하는 부분 문자열의 개수를 구한다.

- 길이가 **홀수**
- **정가운데**의 문자가 **C**
- 문자열이 같더라도 추출된 위치가 다르면 다른 문자열

### 풀이


모든 부분 문자열을 구하며, 가운데가 C인지 확인하는 것은 어렵다.


C 위치를 중심으로 고정하고, 부분문자열을 얼마나 만들어낼 수 있는지를 카운트하면 된다.

- 문자열의 길이를 N, C의 위치를 i라고 두면,  
    - 왼쪽으로 확장 가능한 최대 칸 수 = `i + 1`  
    - 오른쪽으로 확장 가능한 최대 칸 수 = `N - i`  
    - C를 기준으로 좌우 문자 개수가 같아야 하므로 `min(i+1, N-i)` 개의 부분 문자열 생성

### 예제


```plain text
ABCCA
```

- i = 2:  
    - “**C**”, “B**C**C”, “AB**C**CA”  
    - min(2+1, 5-2) = 3
- i = 3:  
    - “**C**”, “C**C**A”  
    - min(3+1, 5-3) = 2

### 마무리

- 답이 `int` 범위를 초과할 수 있다는 것을 꼭 기억하자
- S가 ‘C’로만 이루어진 $5 \times 10^5$ 길이의 문자열이었다면, 답은 약 $N^2 / 4 \approx 6 \times 10^{10}$ 으로, `int` 범위를 충분히 넘길 수 있었다.

![image.png](/TechBlog/images/ABC-458-C-0.png)

