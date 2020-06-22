import os
import cherrypy
import cherrypy_cors
import psycopg2

class Harpoon(object):
    @cherrypy.expose
    def index(self):
        return open("src/index.html")

@cherrypy.expose
class HarpoonWebService(object):

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
        table = input_json["table"]
        fields = ", ".join([val if i==1 else "'" + val + "'"
                            for val in input_json["fields"] for i in (0,1)])
        predicates = ""
        if "predicates" in input_json:
            predicates = " AND ".join(input_json["predicates"])

        orderby = ""
        if "orderby" in input_json:
            orderby = " ORDER BY %s %s" % (input_json["orderby"][0], input_json["orderby"][1])

        with psycopg2.connect(user = "postgres", password = "something",
                              host = "127.0.0.1", port = "5433", database = "postgres") as connection:
            cursor = connection.cursor()
            query = """SELECT json_agg(json_build_object(%s) %s) FROM baking_info.%s""" \
                % (fields, orderby, table)
            if len(predicates) > 0:
                query += " WHERE " + predicates

            print(query)
            cursor.execute(query);
            response = cursor.fetchone()
        return response[0]

def CORS():
    cherrypy.response.headers["Access-Control-Allow-Origin"] = "*"


if __name__ == '__main__':
    conf = {
        '/': {
            'tools.sessions.on': True,
            'tools.staticdir.root': os.path.abspath(os.getcwd()) + "/src"
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
            'tools.staticdir.dir': './assets'
        }
    }

    cherrypy_cors.install()
    cherrypy.tools.CORS = cherrypy.Tool('before_handler', CORS)
    webapp = Harpoon()
    webapp.info = HarpoonWebService()
    cherrypy.quickstart(webapp, '/', conf)
