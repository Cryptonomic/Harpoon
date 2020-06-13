let timings = ""
let executeEntityQuery = conseiljs.ConseilDataClient.executeEntityQuery;
conseiljs.ConseilDataClient.executeEntityQuery = async function(...args) {
    const start = Date.now()
    const result = await executeEntityQuery(...args)
    const end = Date.now()
    let s = Error().stack.split("\n")[2];
    let entry = ((s != undefined) ?
		 s.replace(/\s|at|async| *\([^)]*\) */g, "") :
		 "other")
	+ "," + args[args.length-2] + "," + (end-start) + "," +
	JSON.stringify(args[4])
    
    console.log(entry)
    timings += entry + "<br>"
    return result
}
