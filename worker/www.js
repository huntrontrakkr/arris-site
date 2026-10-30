/* www.arristype.com: every address to the same one on arristype.com. */
export default {
  fetch(request) {
    const url = new URL(request.url);
    url.protocol = 'https:';
    url.hostname = 'arristype.com';
    url.port = '';
    return Response.redirect(url.toString(), 301);
  },
};
