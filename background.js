function check_first_install() {
	if (localStorage.getItem('first_install_ran'))
		return;

	localStorage.setItem('first_install_ran', 1);
	chrome.tabs.create({url: "options.html"});
}
check_first_install();
