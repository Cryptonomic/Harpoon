import cherrypy, cherrypy_cors, os
from microseil import *

class Harpoon(object):
    @cherrypy.expose
    def index(self):
        return open("../ui/index.html")

@cherrypy.expose
class HarpoonWebService(object):
    def parse_query(self, response):
        Table = get_class_by_tablename(response["table"])
        predicates = response["predicates"]
        fields = response["fields"]
        filters = []
        columns = []
        for field in fields:
            columns.append(get_column_by_name(Table, field))
        for predicate in predicates:
            Column = get_column_by_name(Table, predicate["field"])
            op = [p % predicate["op"] for p in ["%s", "%s_", "__%s__"]
                  if hasattr(Column, p % predicate["op"])]
            op = op[0]
            filters.append(getattr(Column, op)(*predicate["value"]))
        query = session.query(*columns).filter(*filters)
        if "orderby" in response:
            OrderCol = get_column_by_name(Table, response["orderby"]["field"])
            query = query.order_by(getattr(OrderCol, response["orderby"]["dir"])())
        return query

    @cherrypy_cors.tools.preflight(
        allowed_methods=["GET", "DELETE", "POST", "PUT"])
    def OPTIONS(self):
        pass

    @cherrypy.tools.accept(media='text/plain')
    def GET(self):
        return "hello"

    @cherrypy.tools.json_in()
    @cherrypy.tools.json_out()
    def POST(self):
        input_json = cherrypy.request.json
        query = self.parse_query(input_json)
        response = query.all()
        return response

def CORS():
    cherrypy.response.headers["Access-Control-Allow-Origin"] = "*"

if __name__ == '__main__':
    conf = {
        '/': {
            'tools.sessions.on': True,
        },
        '/info': {
            'request.dispatch': cherrypy.dispatch.MethodDispatcher(),
            'tools.sessions.on': True,
            'tools.response_headers.on': True,
            'tools.response_headers.headers': [('Content-Type', 'text/plain')],
            'tools.CORS.on': True,
            'cors.expose.on': True,
        },
        '/assets': {
            'tools.staticdir.on': True,
            'tools.staticdir.dir':  os.path.abspath(os.path.join(os.getcwd(), os.pardir)) + "/ui/assets"
        }
    }
    
    net_conf = get_user_config()["cherrypy"]
    cherrypy_cors.install()
    cherrypy.tools.CORS = cherrypy.Tool('before_handler', CORS)
    cherrypy.server.socket_host = net_conf["host"]
    cherrypy.server.socket_port = net_conf["port"]
    webapp = Harpoon()
    webapp.info = HarpoonWebService()
    cherrypy.quickstart(webapp, '/', conf)
