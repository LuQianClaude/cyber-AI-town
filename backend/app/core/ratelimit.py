"""进程内令牌桶限流（M2 起步方案；多实例部署时迁移 Redis）。"""

import threading
import time
from collections import defaultdict


class TokenBucket:
    def __init__(self, rate_per_minute: int, burst: int = 5) -> None:
        self.capacity = rate_per_minute + burst
        self.tokens = float(self.capacity)
        self.rate = rate_per_minute / 60.0
        self.updated = time.monotonic()

    def take(self, n: int = 1) -> bool:
        now = time.monotonic()
        self.tokens = min(self.capacity, self.tokens + (now - self.updated) * self.rate)
        self.updated = now
        if self.tokens >= n:
            self.tokens -= n
            return True
        return False


class RateLimiter:
    def __init__(self, rate_per_minute: int) -> None:
        self._buckets: dict[str, TokenBucket] = defaultdict(lambda: TokenBucket(rate_per_minute))
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        with self._lock:
            return self._buckets[key].take()
