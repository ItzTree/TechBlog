---
title: "[ABC 458-D] Chalkboard Median"
date: 2026-05-22
tags: ["AtCoder", "ABC", "우선순위큐"]
categories: ["PS"]
slug: "ABC-458-D"
math: true
notion_id: "3685c3d8-6808-80e4-bd6a-e8f9b9f53a1f"
notion_last_edited: "2026-05-23T01:28:00.000Z"
draft: false
---


[https://atcoder.jp/contests/abc458/tasks/abc458_d](https://atcoder.jp/contests/abc458/tasks/abc458_d)


정수 `X` 와 쿼리 `Q` 개가 있을 때, 각 쿼리에 대하여 정수 `A`, `B` 를 추가한다.  
수를 추가할 때마다 중앙값(Median)을 출력한다.


### 풀이


숫자를 추가할 때마다 정렬하여 중앙값을 출력하는 것은 $O(Q N \log N) \approx O(Q^2 \log Q)$ 이므로, 다른 방법을 찾아야 한다.


**중앙값**이라는 것은, 수를 정렬했을 때 왼쪽에는 중앙값보다 작은 값이 존재하고 오른쪽에는 큰 값이 존재한다. 두 집합 내부의 순서는 중요하지 않다.


새 값이 들어왔을 때에 어느 집합에 속하는지 판단하기 위해서는 각 집합의 경계값을 알아야 한다.

- 중앙값보다 작은 집합에서는 **최댓값** → 최대 힙
- 중앙값보다 큰 집합에서는 **최솟값** → 최소 힙

이 두 값이 **중앙값의 후보**가 되며, 새로운 수가 들어올 때마다 이 두 값과 비교하면 된다.


`|low_heap| = |high_heap| + (0 or 1)` 이 되도록 두 우선순위큐의 원소 개수를 유지하며 숫자를 추가/이동한다.


쿼리를 수행할 때마다 `low_heap` 에는 `N+1` 개, `high_heap`에는 `N`개의 원소가 존재하고, `low_heap.top()`으로 중앙값을 추출할 수 있다.


### 예제


```plain text
5
3
2 3
1 2
8 9
```

- low = [5], high = []
- `2 3`  
    - **2**: low = [2, 5], high = [] → low = [2], high = [5]  
    - **3**: low = [2, 3], high = [5]  
    - 중앙값 = 3
- `1 2`  
    - low = [1, 2, 2], high = [3, 5]  
    - 중앙값 = 2
- `8 9`  
    - low = [1, 2, 2, 3], high = [5, 8, 9]  
    - 중앙값 = 3

### 마무리


A, B를 동시에 처리하지 말고 한 개씩 처리하는 것이 로직이 더 단순했다.


매 쿼리마다 **고정된 k번째의 수**를 출력하도록 한다면 같은 아이디어를 사용할 수 있겠다.


![image.png](/TechBlog/images/ABC-458-D-0.png)

