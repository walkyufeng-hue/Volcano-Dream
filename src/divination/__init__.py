from . import base
from . import dream
from .base import DivinationFactory

import logging

_logger = logging.getLogger("divination factory")
_logger.info(
    f"Loaded divination types: {list(DivinationFactory.divination_map.keys())}"
)
