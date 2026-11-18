class StaticPathConfig:
    def __init__(self, url_path, path, cache_headers=True):
        self.url_path = url_path
        self.path = path
        self.cache_headers = cache_headers


class HomeAssistantView:
    """Stand-in for homeassistant.components.http.HomeAssistantView (only the
    class attributes the integration sets are needed here)."""

    url = None
    name = None
    requires_auth = True
