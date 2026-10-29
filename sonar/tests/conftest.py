import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent))
# lokalni testni strežniki ne smejo iti skozi proxy
for var in ('NO_PROXY', 'no_proxy'):
    os.environ[var] = ','.join(filter(None, [os.environ.get(var), '127.0.0.1', 'localhost']))
