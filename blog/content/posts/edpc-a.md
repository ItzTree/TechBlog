---
title: "[EDPC A] Frog 1"
date: 2026-05-29
tags: ["AtCoder", "EDPC", "DP"]
categories: ["PS"]
slug: "edpc-a"
math: true
notion_id: "36e5c3d8-6808-80ca-a05b-e102d6082b81"
notion_last_edited: "2026-05-28T15:44:00.000Z"
draft: false
---


[https://atcoder.jp/contests/dp/tasks/dp_a](https://atcoder.jp/contests/dp/tasks/dp_a) 


개구리가 Stone `1` 에서 출발해 `N` 번째 Stone까지 점프한다. Stone `i` 의 높이는 `h[i]`

- 발판 `i` 에서는 `i+1` 또는 `i+2`로만 점프 가능
- 점프 비용은 `|h[i] - h[j]|`
- 발판 `N` 에 도달하는 총 비용의 최솟값 구하기

### 풀이


DP의 전형적인 문제다. `dp[i]` 에서의 최솟값을 구하기 위해서는 `i-1` 의 정보나, `i-2` 의 정보를 활용할 수 있다.

- `dp[i]`: Stone `i` 에 도달하는 총 비용의 최솟값  
    - `dp[i-1] + |h[i] - h[i-1]|`  
    - `dp[i-2] + |h[i] - h[i-2]|`  
    - 위 값 중 작은 값을 고르면 `i` 에서의 최솟값이 보장된다.
- `dp[1]` 은 0이고, `dp[2]` 는 `|h[1] - h[2]|` 이다.

각 칸을 한 번씩만 계산하므로 $O(N)$ 으로 해결할 수 있다.


### 예제


`N = 4`, `h = [10, 30, 40, 20]` (1-based)이라 하자.

- `dp[1] = 0`
- `dp[2] = |10 - 30| = 20`
- `dp[3] = min(dp[2] + |40-30|, dp[1] + |40-10|) = min(20+10, 0+30) = 30`
- `dp[4] = min(dp[3] + |20-40|, dp[2] + |20-30|) = min(30+20, 20+10) = 30`

답은 `30`. 경로 `1 → 2 → 4`가 비용 `20 + 10 = 30`으로 최적.


### 마무리


![image.png](/TechBlog/images/edpc-a-0.png)

