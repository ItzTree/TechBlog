---
title: "Hello World - 블로그 테스트"
date: 2026-05-11
tags: ["테스트"]
categories: ["개발"]
slug: "hello-world"
math: true
draft: false
---

## 코드 블록 테스트

```python
def solution(n):
    dp = [0] * (n + 1)
    dp[1] = 1
    for i in range(2, n + 1):
        dp[i] = dp[i-1] + dp[i-2]
    return dp[n]

print(solution(10))
```

## 수식 테스트

피보나치 수열의 일반항:

$$F_n = \frac{\phi^n - \psi^n}{\sqrt{5}}$$

여기서 $\phi = \frac{1 + \sqrt{5}}{2}$, $\psi = \frac{1 - \sqrt{5}}{2}$ 이다.

시간복잡도는 $O(n)$이다.

## 목록 테스트

- 항목 1
- 항목 2
  - 서브 항목 2-1
  - 서브 항목 2-2

> 이것은 인용문입니다.
