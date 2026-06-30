// Drive status is "auto-managed": once the deadline passes, a drive is always
// reported as 'closed' regardless of its stored status. Before the deadline we
// trust whatever the TPO set (upcoming / ongoing).
//
// effectiveStatus(drive) → the status to show / enforce right now
function effectiveStatus(drive) {
    if (!drive) return 'closed';
    if (drive.deadline && new Date(drive.deadline).getTime() < Date.now()) {
        return 'closed';
    }
    return drive.status || 'ongoing';
}

// can a candidate still respond? only while the drive is open and before deadline
function isDriveOpen(drive) {
    return effectiveStatus(drive) !== 'closed';
}

module.exports = { effectiveStatus, isDriveOpen };
